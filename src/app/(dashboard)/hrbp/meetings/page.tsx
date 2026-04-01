import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { MeetingsList } from './meetings-list'

export default async function HrbpMeetingsPage() {
  const user = await requireRole(['hrbp'])

  // Get HRBP's departments
  const hrbpDepts = await prisma.hrbpDepartment.findMany({
    where: { hrbp_id: user.id },
    select: { department_id: true },
  })
  const deptIds = hrbpDepts.map(d => d.department_id)

  // Get active cycles (self_review or manager_review phase)
  const cycles = await prisma.cycle.findMany({
    where: { status: { in: ['self_review', 'manager_review'] } },
    orderBy: { created_at: 'desc' },
    select: { id: true, name: true, status: true, manager_review_deadline: true },
  })

  if (cycles.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Review Discussion Meetings</h1>
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500">No active cycles in self-review or manager-review phase.</p>
        </div>
      </div>
    )
  }

  // For each cycle, get employees who submitted self-review and need/have meetings
  const meetingsData = await Promise.all(
    cycles.map(async (cycle) => {
      // Get employees who submitted self-review in this cycle
      const reviews = await prisma.review.findMany({
        where: {
          cycle_id: cycle.id,
          status: 'submitted',
          employee: deptIds.length > 0
            ? { department_id: { in: deptIds }, is_active: true }
            : { is_active: true },
        },
        select: {
          employee_id: true,
          submitted_at: true,
          employee: {
            select: {
              id: true,
              full_name: true,
              email: true,
              designation: true,
              department: { select: { name: true } },
              manager: { select: { id: true, full_name: true, email: true } },
            },
          },
        },
      })

      // Get existing meetings for this cycle
      const meetings = await prisma.reviewMeeting.findMany({
        where: { cycle_id: cycle.id },
        include: {
          minutes: {
            select: {
              id: true,
              key_discussion_points: true,
              strengths_highlighted: true,
              areas_for_improvement: true,
              action_items: true,
              employee_agreement: true,
              concerns_raised: true,
              submitted_by: true,
              created_at: true,
            },
          },
          employee: { select: { full_name: true } },
          manager: { select: { full_name: true } },
          hrbp: { select: { full_name: true } },
        },
      })

      const meetingMap = new Map(meetings.map(m => [m.employee_id, m]))

      const employees = reviews.map(r => {
        const meeting = meetingMap.get(r.employee_id)
        return {
          id: r.employee_id,
          full_name: r.employee.full_name,
          email: r.employee.email,
          designation: r.employee.designation,
          department: r.employee.department?.name ?? 'N/A',
          manager_id: r.employee.manager?.id ?? null,
          manager_name: r.employee.manager?.full_name ?? 'N/A',
          self_review_submitted_at: r.submitted_at?.toISOString() ?? null,
          meeting: meeting ? {
            id: meeting.id,
            status: meeting.status,
            scheduled_at: meeting.scheduled_at.toISOString(),
            meet_link: meeting.meet_link,
            completed_at: meeting.completed_at?.toISOString() ?? null,
            cancelled_at: meeting.cancelled_at?.toISOString() ?? null,
            cancel_reason: meeting.cancel_reason,
            hrbp_name: meeting.hrbp.full_name,
            minutes: meeting.minutes ? {
              id: meeting.minutes.id,
              key_discussion_points: meeting.minutes.key_discussion_points,
              strengths_highlighted: meeting.minutes.strengths_highlighted,
              areas_for_improvement: meeting.minutes.areas_for_improvement,
              action_items: meeting.minutes.action_items as Array<{ description: string; owner: string; deadline: string }>,
              employee_agreement: meeting.minutes.employee_agreement,
              concerns_raised: meeting.minutes.concerns_raised,
              created_at: meeting.minutes.created_at.toISOString(),
            } : null,
          } : null,
        }
      })

      return {
        cycle: {
          id: cycle.id,
          name: cycle.name,
          status: cycle.status,
          manager_review_deadline: cycle.manager_review_deadline?.toISOString() ?? null,
        },
        employees,
      }
    })
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Review Discussion Meetings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Schedule and manage mandatory review discussions between employees, managers, and HRBP.
          Manager reviews are unlocked after MOM is submitted.
        </p>
      </div>
      <MeetingsList data={meetingsData} hrbpId={user.id} />
    </div>
  )
}
