'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { notifyUsers } from '@/lib/email'
import { createCalendarEvent, cancelCalendarEvent, generateFallbackMeetLink } from '@/lib/google-calendar'
import type { ActionResult } from '@/lib/types'

/**
 * Schedule a review discussion meeting.
 * Called by HRBP after an employee submits their self-review.
 */
export async function scheduleMeeting(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole(['hrbp'])

    const cycleId = formData.get('cycle_id') as string
    const employeeId = formData.get('employee_id') as string
    const scheduledAt = formData.get('scheduled_at') as string
    const durationMinutes = Number(formData.get('duration_minutes') || 60)

    if (!cycleId || !employeeId || !scheduledAt) {
      return { data: null, error: 'Cycle, employee, and scheduled time are required' }
    }

    const scheduledDate = new Date(scheduledAt)
    if (isNaN(scheduledDate.getTime()) || scheduledDate < new Date()) {
      return { data: null, error: 'Scheduled time must be in the future' }
    }

    // Check employee exists and get their manager
    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      select: { id: true, full_name: true, email: true, manager_id: true, manager: { select: { id: true, full_name: true, email: true } } },
    })
    if (!employee || !employee.manager) {
      return { data: null, error: 'Employee or their manager not found' }
    }

    // Verify self-review is submitted
    const review = await prisma.review.findUnique({
      where: { cycle_id_employee_id: { cycle_id: cycleId, employee_id: employeeId } },
      select: { status: true },
    })
    if (!review || review.status !== 'submitted') {
      return { data: null, error: 'Employee must submit their self-review before scheduling a discussion meeting' }
    }

    // Check no meeting already exists for this cycle+employee
    const existing = await prisma.reviewMeeting.findUnique({
      where: { cycle_id_employee_id: { cycle_id: cycleId, employee_id: employeeId } },
    })
    if (existing && existing.status !== 'cancelled') {
      return { data: null, error: 'A meeting has already been scheduled for this employee in this cycle' }
    }

    // Get cycle info for the calendar event
    const cycle = await prisma.cycle.findUnique({
      where: { id: cycleId },
      select: { name: true },
    })

    // Get HRBP email for organizer
    const hrbp = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, full_name: true },
    })

    // Try Google Calendar API — fallback to generated meet link
    let meetLink: string | null = null
    let calendarEventId: string | null = null

    try {
      const calendarResult = await createCalendarEvent({
        summary: `Performance Discussion: ${employee.full_name} — ${cycle?.name ?? 'Review Cycle'}`,
        description: `Review discussion meeting for ${employee.full_name}.\n\nParticipants:\n- Employee: ${employee.full_name}\n- Manager: ${employee.manager.full_name}\n- HRBP: ${hrbp?.full_name ?? 'HRBP'}\n\nThis meeting is part of the performance review process. Please come prepared with your self-assessment and goals.`,
        startTime: scheduledDate,
        durationMinutes,
        attendees: [
          { email: employee.email, displayName: employee.full_name },
          { email: employee.manager.email, displayName: employee.manager.full_name },
          { email: hrbp?.email ?? user.email, displayName: hrbp?.full_name ?? 'HRBP' },
        ],
        organizerEmail: hrbp?.email ?? user.email,
      })

      if (calendarResult) {
        meetLink = calendarResult.meetLink
        calendarEventId = calendarResult.eventId
      }
    } catch (calendarErr) {
      console.error('Google Calendar API error (falling back to generated link):', calendarErr)
    }

    if (!meetLink) {
      meetLink = generateFallbackMeetLink()
    }

    // If existing cancelled meeting, delete it first
    if (existing && existing.status === 'cancelled') {
      await prisma.reviewMeeting.delete({ where: { id: existing.id } })
    }

    const meeting = await prisma.reviewMeeting.create({
      data: {
        cycle_id: cycleId,
        employee_id: employeeId,
        manager_id: employee.manager.id,
        hrbp_id: user.id,
        status: 'scheduled',
        scheduled_at: scheduledDate,
        meet_link: meetLink,
        calendar_event_id: calendarEventId,
        scheduled_by: user.id,
      },
      select: { id: true },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        cycle_id: cycleId,
        changed_by: user.id,
        action: 'meeting_scheduled',
        entity_type: 'review_meeting',
        entity_id: meeting.id,
        new_value: {
          employee_id: employeeId,
          manager_id: employee.manager.id,
          scheduled_at: scheduledDate.toISOString(),
          meet_link: meetLink,
        },
      },
    })

    // Notify employee + manager (fire-and-forget, don't block on notification errors)
    notifyUsers([employeeId, employee.manager.id], 'meeting_scheduled', {
      employee_name: employee.full_name,
      cycle_name: cycle?.name ?? 'Review Cycle',
      scheduled_at: scheduledDate.toISOString(),
      meet_link: meetLink ?? '',
      hrbp_name: hrbp?.full_name ?? 'HRBP',
    }).catch(err => console.error('Failed to send meeting_scheduled notifications:', err))

    revalidatePath('/hrbp/meetings')
    revalidatePath(`/manager/${employeeId}/review`)
    revalidatePath('/employee')
    return { data: null, error: null }
  } catch (err) {
    console.error('scheduleMeeting error:', err)
    return { data: null, error: err instanceof Error ? err.message : 'Failed to schedule meeting. Please try again.' }
  }
}

/**
 * Submit Meeting Minutes (MOM) after the discussion meeting.
 * Called by HRBP. This also marks the meeting as completed,
 * unlocking the manager review.
 */
export async function submitMeetingMinutes(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole(['hrbp'])

    const meetingId = formData.get('meeting_id') as string
    const keyDiscussionPoints = (formData.get('key_discussion_points') as string)?.trim()
    const strengthsHighlighted = (formData.get('strengths_highlighted') as string)?.trim()
    const areasForImprovement = (formData.get('areas_for_improvement') as string)?.trim()
    const actionItemsRaw = formData.get('action_items') as string
    const employeeAgreement = formData.get('employee_agreement') === 'true'
    const concernsRaised = (formData.get('concerns_raised') as string)?.trim() || null

    if (!meetingId || !keyDiscussionPoints || !strengthsHighlighted || !areasForImprovement) {
      return { data: null, error: 'Meeting ID, discussion points, strengths, and areas for improvement are required' }
    }

    // Validate action items JSON
    let actionItems: Array<{ description: string; owner: string; deadline: string }> = []
    try {
      actionItems = actionItemsRaw ? JSON.parse(actionItemsRaw) : []
    } catch {
      return { data: null, error: 'Invalid action items format' }
    }

    const meeting = await prisma.reviewMeeting.findUnique({
      where: { id: meetingId },
      select: { id: true, status: true, cycle_id: true, employee_id: true, manager_id: true, hrbp_id: true },
    })

    if (!meeting) return { data: null, error: 'Meeting not found' }
    if (meeting.status !== 'scheduled') return { data: null, error: 'Meeting is not in scheduled status' }
    if (meeting.hrbp_id !== user.id) {
      console.warn(`MOM submitted by ${user.id} for meeting owned by HRBP ${meeting.hrbp_id}`)
    }

    // Create MOM and update meeting status in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.meetingMinutes.create({
        data: {
          meeting_id: meetingId,
          key_discussion_points: keyDiscussionPoints,
          strengths_highlighted: strengthsHighlighted,
          areas_for_improvement: areasForImprovement,
          action_items: actionItems,
          employee_agreement: employeeAgreement,
          concerns_raised: concernsRaised,
          submitted_by: user.id,
        },
      })

      await tx.reviewMeeting.update({
        where: { id: meetingId },
        data: {
          status: 'completed',
          completed_at: new Date(),
          updated_at: new Date(),
        },
      })
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        cycle_id: meeting.cycle_id,
        changed_by: user.id,
        action: 'meeting_mom_submitted',
        entity_type: 'meeting_minutes',
        entity_id: meetingId,
        new_value: {
          employee_id: meeting.employee_id,
          employee_agreement: employeeAgreement,
          action_items_count: actionItems.length,
        },
      },
    })

    // Get cycle name for notification
    const cycle = await prisma.cycle.findUnique({
      where: { id: meeting.cycle_id },
      select: { name: true },
    })
    const employee = await prisma.user.findUnique({
      where: { id: meeting.employee_id },
      select: { full_name: true },
    })

    // Notify (fire-and-forget)
    notifyUsers([meeting.manager_id, meeting.employee_id], 'meeting_mom_submitted', {
      employee_name: employee?.full_name ?? 'Employee',
      cycle_name: cycle?.name ?? 'Review Cycle',
      hrbp_name: user.full_name,
    }).catch(err => console.error('Failed to send meeting_mom_submitted notifications:', err))

    revalidatePath('/hrbp/meetings')
    revalidatePath(`/manager/${meeting.employee_id}/review`)
    revalidatePath('/employee')
    return { data: null, error: null }
  } catch (err) {
    console.error('submitMeetingMinutes error:', err)
    return { data: null, error: err instanceof Error ? err.message : 'Failed to submit meeting minutes. Please try again.' }
  }
}

/**
 * Cancel a scheduled meeting.
 */
export async function cancelMeeting(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole(['hrbp'])

    const meetingId = formData.get('meeting_id') as string
    const reason = (formData.get('cancel_reason') as string)?.trim()

    if (!meetingId) return { data: null, error: 'Meeting ID is required' }

    const meeting = await prisma.reviewMeeting.findUnique({
      where: { id: meetingId },
      select: { id: true, status: true, cycle_id: true, employee_id: true, manager_id: true, calendar_event_id: true, hrbp: { select: { email: true } } },
    })

    if (!meeting) return { data: null, error: 'Meeting not found' }
    if (meeting.status !== 'scheduled') return { data: null, error: 'Only scheduled meetings can be cancelled' }

    // Cancel Google Calendar event if it exists
    if (meeting.calendar_event_id && meeting.hrbp?.email) {
      try {
        await cancelCalendarEvent(meeting.calendar_event_id, meeting.hrbp.email)
      } catch (calErr) {
        console.error('Failed to cancel calendar event (continuing):', calErr)
      }
    }

    await prisma.reviewMeeting.update({
      where: { id: meetingId },
      data: {
        status: 'cancelled',
        cancelled_at: new Date(),
        cancel_reason: reason || null,
        updated_at: new Date(),
      },
    })

    await prisma.auditLog.create({
      data: {
        cycle_id: meeting.cycle_id,
        changed_by: user.id,
        action: 'meeting_cancelled',
        entity_type: 'review_meeting',
        entity_id: meetingId,
        new_value: { reason },
      },
    })

    revalidatePath('/hrbp/meetings')
    revalidatePath(`/manager/${meeting.employee_id}/review`)
    return { data: null, error: null }
  } catch (err) {
    console.error('cancelMeeting error:', err)
    return { data: null, error: err instanceof Error ? err.message : 'Failed to cancel meeting. Please try again.' }
  }
}
