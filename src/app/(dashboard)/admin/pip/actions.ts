'use server'

import { prisma } from '@/lib/prisma'
import { requireRole, getCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import { z } from 'zod'
import logger from '@/lib/logger'

// ─── Zod Schemas ──────────────────────────────────────────────────────

const createPipSchema = z.object({
  employeeId: z.string().uuid(),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  cycleId: z.string().uuid().optional(),
})

const milestoneSchema = z.object({
  pipId: z.string().uuid(),
  title: z.string().min(3),
  description: z.string().optional(),
  targetMetric: z.string().min(3, 'Target metric is required'),
  dueDate: z.coerce.date(),
})

const checkInSchema = z.object({
  pipId: z.string().uuid(),
  checkInDate: z.coerce.date(),
  progressRating: z.coerce.number().int().min(1).max(5),
  notes: z.string().min(5),
  nextSteps: z.string().optional(),
})

// ─── Helpers ──────────────────────────────────────────────────────────

function revalidatePipPaths() {
  revalidatePath('/admin/pip')
  revalidatePath('/hrbp/pip')
  revalidatePath('/manager/pip')
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// ─── 1. Create PIP ───────────────────────────────────────────────────

export async function createPip(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['admin', 'manager', 'hrbp'])

  const parsed = createPipSchema.safeParse({
    employeeId: formData.get('employee_id'),
    reason: formData.get('reason'),
    startDate: formData.get('start_date'),
    endDate: formData.get('end_date'),
    cycleId: formData.get('cycle_id') || undefined,
  })

  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0].message }
  }

  try {
    // Look up employee to get manager_id and department
    const employee = await prisma.user.findUnique({
      where: { id: parsed.data.employeeId },
      select: { id: true, manager_id: true, department_id: true },
    })

    if (!employee) {
      return { data: null, error: 'Employee not found' }
    }

    // Auto-resolve skip-level manager: employee's manager's manager_id
    let skipLevelManagerId: string | null = null
    if (employee.manager_id) {
      const manager = await prisma.user.findUnique({
        where: { id: employee.manager_id },
        select: { manager_id: true },
      })
      skipLevelManagerId = manager?.manager_id ?? null
    }

    // Resolve HRBP: if current user is HRBP, use them; else look up via hrbp_departments
    let hrbpId: string
    if (user.role === 'hrbp') {
      hrbpId = user.id
    } else {
      const hrbpAssignment = employee.department_id
        ? await prisma.hrbpDepartment.findFirst({
            where: { department_id: employee.department_id },
            select: { hrbp_id: true },
          })
        : null
      if (!hrbpAssignment) {
        return { data: null, error: 'No HRBP assigned for this employee\'s department. Please assign an HRBP first in Admin > Users.' }
      }
      hrbpId = hrbpAssignment.hrbp_id
    }

    const pip = await prisma.pip.create({
      data: {
        employee_id: parsed.data.employeeId,
        manager_id: employee.manager_id ?? user.id,
        initiated_by: user.id,
        hrbp_id: hrbpId,
        cycle_id: parsed.data.cycleId ?? null,
        skip_level_manager_id: skipLevelManagerId,
        reason: parsed.data.reason,
        start_date: parsed.data.startDate,
        end_date: parsed.data.endDate,
      },
    })

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'pip_created',
        entity_type: 'pip',
        entity_id: pip.id,
        new_value: {
          employeeId: parsed.data.employeeId,
          reason: parsed.data.reason,
          startDate: parsed.data.startDate.toISOString(),
          endDate: parsed.data.endDate.toISOString(),
        },
      },
    })
  } catch (e) {
    logger.error('createPip', 'Failed to create PIP', undefined, e)
    return { data: null, error: e instanceof Error ? e.message : 'Failed to create PIP' }
  }

  revalidatePipPaths()
  return { data: null, error: null }
}

// ─── 2. Activate PIP ─────────────────────────────────────────────────

export async function activatePip(pipId: string): Promise<ActionResult> {
  const user = await requireRole(['hrbp'])

  try {
    const pip = await prisma.pip.findUnique({ where: { id: pipId } })
    if (!pip) return { data: null, error: 'PIP not found' }
    if (pip.status !== 'draft') return { data: null, error: 'PIP must be in draft status to activate' }

    await prisma.pip.update({
      where: { id: pipId },
      data: { status: 'active' },
    })

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'pip_activated',
        entity_type: 'pip',
        entity_id: pipId,
        old_value: { status: 'draft' },
        new_value: { status: 'active' },
      },
    })
  } catch (e) {
    logger.error('activatePip', 'Failed to activate PIP', undefined, e)
    return { data: null, error: e instanceof Error ? e.message : 'Failed to activate PIP' }
  }

  revalidatePipPaths()
  return { data: null, error: null }
}

// ─── 3. Acknowledge PIP ──────────────────────────────────────────────

export async function acknowledgePip(pipId: string): Promise<ActionResult> {
  const user = await getCurrentUser()

  try {
    const pip = await prisma.pip.findUnique({ where: { id: pipId } })
    if (!pip) return { data: null, error: 'PIP not found' }
    if (pip.employee_id !== user.id) return { data: null, error: 'You can only acknowledge your own PIP' }

    await prisma.pip.update({
      where: { id: pipId },
      data: { employee_acknowledged_at: new Date() },
    })

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'pip_acknowledged',
        entity_type: 'pip',
        entity_id: pipId,
      },
    })
  } catch (e) {
    logger.error('acknowledgePip', 'Failed to acknowledge PIP', undefined, e)
    return { data: null, error: e instanceof Error ? e.message : 'Failed to acknowledge PIP' }
  }

  revalidatePipPaths()
  return { data: null, error: null }
}

// ─── 4. Add Milestone ────────────────────────────────────────────────

export async function addMilestone(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['manager', 'hrbp'])

  const parsed = milestoneSchema.safeParse({
    pipId: formData.get('pip_id'),
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    targetMetric: formData.get('target_metric'),
    dueDate: formData.get('due_date'),
  })

  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0].message }
  }

  try {
    // Get max sort_order for this pip
    const maxOrder = await prisma.pipMilestone.aggregate({
      where: { pip_id: parsed.data.pipId },
      _max: { sort_order: true },
    })

    const milestone = await prisma.pipMilestone.create({
      data: {
        pip_id: parsed.data.pipId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        target_metric: parsed.data.targetMetric,
        due_date: parsed.data.dueDate,
        sort_order: (maxOrder._max.sort_order ?? -1) + 1,
      },
    })

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'pip_milestone_added',
        entity_type: 'pip_milestone',
        entity_id: milestone.id,
        new_value: {
          pipId: parsed.data.pipId,
          title: parsed.data.title,
          targetMetric: parsed.data.targetMetric,
        },
      },
    })
  } catch (e) {
    logger.error('addMilestone', 'Failed to add milestone', undefined, e)
    return { data: null, error: e instanceof Error ? e.message : 'Failed to add milestone' }
  }

  revalidatePipPaths()
  return { data: null, error: null }
}

// ─── 5. Update Milestone Status ──────────────────────────────────────

export async function updateMilestoneStatus(
  milestoneId: string,
  status: string,
): Promise<ActionResult> {
  const user = await requireRole(['manager', 'hrbp'])

  const validStatuses = ['pending', 'in_progress', 'completed', 'missed'] as const
  if (!validStatuses.includes(status as (typeof validStatuses)[number])) {
    return { data: null, error: 'Invalid milestone status' }
  }

  try {
    const milestone = await prisma.pipMilestone.findUnique({ where: { id: milestoneId } })
    if (!milestone) return { data: null, error: 'Milestone not found' }

    await prisma.pipMilestone.update({
      where: { id: milestoneId },
      data: { status: status as (typeof validStatuses)[number] },
    })

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'pip_milestone_status_updated',
        entity_type: 'pip_milestone',
        entity_id: milestoneId,
        old_value: { status: milestone.status },
        new_value: { status },
      },
    })
  } catch (e) {
    logger.error('updateMilestoneStatus', 'Failed to update milestone status', undefined, e)
    return { data: null, error: e instanceof Error ? e.message : 'Failed to update milestone status' }
  }

  revalidatePipPaths()
  return { data: null, error: null }
}

// ─── 6. Sign Off Milestone ───────────────────────────────────────────

export async function signOffMilestone(milestoneId: string): Promise<ActionResult> {
  const user = await requireRole(['hrbp'])

  try {
    const milestone = await prisma.pipMilestone.findUnique({ where: { id: milestoneId } })
    if (!milestone) return { data: null, error: 'Milestone not found' }

    await prisma.pipMilestone.update({
      where: { id: milestoneId },
      data: {
        hrbp_signed_off_at: new Date(),
        hrbp_signed_off_by: user.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'pip_milestone_signed_off',
        entity_type: 'pip_milestone',
        entity_id: milestoneId,
      },
    })
  } catch (e) {
    logger.error('signOffMilestone', 'Failed to sign off milestone', undefined, e)
    return { data: null, error: e instanceof Error ? e.message : 'Failed to sign off milestone' }
  }

  revalidatePipPaths()
  return { data: null, error: null }
}

// ─── 7. Add Check-In ────────────────────────────────────────────────

export async function addCheckIn(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['manager', 'hrbp'])

  const parsed = checkInSchema.safeParse({
    pipId: formData.get('pip_id'),
    checkInDate: formData.get('check_in_date'),
    progressRating: formData.get('progress_rating'),
    notes: formData.get('notes'),
    nextSteps: formData.get('next_steps') || undefined,
  })

  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0].message }
  }

  try {
    const checkIn = await prisma.pipCheckIn.create({
      data: {
        pip_id: parsed.data.pipId,
        created_by: user.id,
        check_in_date: parsed.data.checkInDate,
        progress_rating: parsed.data.progressRating,
        notes: parsed.data.notes,
        next_steps: parsed.data.nextSteps ?? null,
      },
    })

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'pip_check_in_added',
        entity_type: 'pip_check_in',
        entity_id: checkIn.id,
        new_value: {
          pipId: parsed.data.pipId,
          progressRating: parsed.data.progressRating,
        },
      },
    })
  } catch (e) {
    logger.error('addCheckIn', 'Failed to add check-in', undefined, e)
    return { data: null, error: e instanceof Error ? e.message : 'Failed to add check-in' }
  }

  revalidatePipPaths()
  return { data: null, error: null }
}

// ─── 8. Respond to Check-In ─────────────────────────────────────────

export async function respondToCheckIn(
  checkInId: string,
  response: string,
): Promise<ActionResult> {
  const user = await getCurrentUser()

  try {
    const checkIn = await prisma.pipCheckIn.findUnique({
      where: { id: checkInId },
      include: { pip: { select: { employee_id: true } } },
    })

    if (!checkIn) return { data: null, error: 'Check-in not found' }
    if (checkIn.pip.employee_id !== user.id) {
      return { data: null, error: 'You can only respond to check-ins on your own PIP' }
    }

    await prisma.pipCheckIn.update({
      where: { id: checkInId },
      data: { employee_response: response },
    })

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'pip_check_in_responded',
        entity_type: 'pip_check_in',
        entity_id: checkInId,
      },
    })
  } catch (e) {
    logger.error('respondToCheckIn', 'Failed to respond to check-in', undefined, e)
    return { data: null, error: e instanceof Error ? e.message : 'Failed to respond to check-in' }
  }

  revalidatePipPaths()
  return { data: null, error: null }
}

// ─── 9. Extend PIP ──────────────────────────────────────────────────

export async function extendPip(
  pipId: string,
  newEndDate: string,
): Promise<ActionResult> {
  const user = await requireRole(['manager', 'hrbp'])

  const parsedDate = z.coerce.date().safeParse(newEndDate)
  if (!parsedDate.success) {
    return { data: null, error: 'Invalid date format' }
  }

  try {
    const pip = await prisma.pip.findUnique({ where: { id: pipId } })
    if (!pip) return { data: null, error: 'PIP not found' }

    await prisma.pip.update({
      where: { id: pipId },
      data: {
        end_date: parsedDate.data,
        status: 'extended',
      },
    })

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'pip_extended',
        entity_type: 'pip',
        entity_id: pipId,
        old_value: { endDate: pip.end_date.toISOString() },
        new_value: { endDate: parsedDate.data.toISOString(), status: 'extended' },
      },
    })
  } catch (e) {
    logger.error('extendPip', 'Failed to extend PIP', undefined, e)
    return { data: null, error: e instanceof Error ? e.message : 'Failed to extend PIP' }
  }

  revalidatePipPaths()
  return { data: null, error: null }
}

// ─── 10. Complete PIP ────────────────────────────────────────────────

export async function completePip(
  pipId: string,
  outcome: string,
  escalationNote?: string,
): Promise<ActionResult> {
  const user = await requireRole(['hrbp'])

  const validOutcomes = ['improved', 'partially_improved', 'not_improved'] as const
  if (!validOutcomes.includes(outcome as (typeof validOutcomes)[number])) {
    return { data: null, error: 'Invalid outcome' }
  }

  try {
    const pip = await prisma.pip.findUnique({ where: { id: pipId } })
    if (!pip) return { data: null, error: 'PIP not found' }

    await prisma.pip.update({
      where: { id: pipId },
      data: {
        status: 'completed',
        outcome: outcome as (typeof validOutcomes)[number],
        escalation_note: outcome === 'not_improved' ? (escalationNote ?? null) : null,
      },
    })

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'pip_completed',
        entity_type: 'pip',
        entity_id: pipId,
        old_value: { status: pip.status },
        new_value: { status: 'completed', outcome },
      },
    })
  } catch (e) {
    logger.error('completePip', 'Failed to complete PIP', undefined, e)
    return { data: null, error: e instanceof Error ? e.message : 'Failed to complete PIP' }
  }

  revalidatePipPaths()
  return { data: null, error: null }
}

// ─── 11. Close PIP ──────────────────────────────────────────────────

export async function closePip(pipId: string): Promise<ActionResult> {
  const user = await requireRole(['hrbp', 'admin'])

  try {
    const pip = await prisma.pip.findUnique({ where: { id: pipId } })
    if (!pip) return { data: null, error: 'PIP not found' }

    await prisma.pip.update({
      where: { id: pipId },
      data: { status: 'closed' },
    })

    // If outcome is not_improved and auto_flag_next_cycle is true, log auto-flag
    if (pip.outcome === 'not_improved' && pip.auto_flag_next_cycle) {
      await prisma.auditLog.create({
        data: {
          changed_by: user.id,
          action: 'pip_auto_flag_next_cycle',
          entity_type: 'pip',
          entity_id: pipId,
          new_value: { employeeId: pip.employee_id },
        },
      })
    }

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'pip_closed',
        entity_type: 'pip',
        entity_id: pipId,
        old_value: { status: pip.status },
        new_value: { status: 'closed' },
      },
    })
  } catch (e) {
    logger.error('closePip', 'Failed to close PIP', undefined, e)
    return { data: null, error: e instanceof Error ? e.message : 'Failed to close PIP' }
  }

  revalidatePipPaths()
  return { data: null, error: null }
}

// ─── 12. Upload Document ─────────────────────────────────────────────

export async function uploadDocument(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['manager', 'hrbp'])

  const pipId = formData.get('pip_id') as string
  const fileName = formData.get('file_name') as string
  const fileUrl = formData.get('file_url') as string
  const fileType = formData.get('file_type') as string
  const description = (formData.get('description') as string) || null

  if (!pipId || !fileName || !fileUrl || !fileType) {
    return { data: null, error: 'Missing required fields: pip_id, file_name, file_url, file_type' }
  }

  try {
    const doc = await prisma.pipDocument.create({
      data: {
        pip_id: pipId,
        uploaded_by: user.id,
        file_name: fileName,
        file_url: fileUrl,
        file_type: fileType,
        description,
      },
    })

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'pip_document_uploaded',
        entity_type: 'pip_document',
        entity_id: doc.id,
        new_value: { pipId, fileName, fileType },
      },
    })
  } catch (e) {
    logger.error('uploadDocument', 'Failed to upload document', undefined, e)
    return { data: null, error: e instanceof Error ? e.message : 'Failed to upload document' }
  }

  revalidatePipPaths()
  return { data: null, error: null }
}

// ─── 13. Export PIP CSV ──────────────────────────────────────────────

export async function exportPipCsv(): Promise<ActionResult<string>> {
  await requireRole(['admin', 'hrbp'])

  try {
    const { fetchPipList } = await import('@/lib/db/pip')
    const pips = await fetchPipList()

    const columns = [
      { key: 'employeeName', label: 'Employee' },
      { key: 'employeeEmail', label: 'Email' },
      { key: 'department', label: 'Department' },
      { key: 'managerName', label: 'Manager' },
      { key: 'status', label: 'Status' },
      { key: 'startDate', label: 'Start Date' },
      { key: 'endDate', label: 'End Date' },
      { key: 'daysRemaining', label: 'Days Remaining' },
      { key: 'milestoneProgress', label: 'Milestones' },
      { key: 'outcome', label: 'Outcome' },
    ]

    const header = columns.map(c => escapeCsvField(c.label)).join(',')
    const body = pips
      .map(row =>
        columns
          .map(c => {
            if (c.key === 'startDate' || c.key === 'endDate') {
              const d = row[c.key as keyof typeof row] as Date
              return escapeCsvField(d ? new Date(d).toISOString().split('T')[0] : '')
            }
            if (c.key === 'milestoneProgress') {
              const m = row.milestoneProgress
              return escapeCsvField(`${m.completed}/${m.total}`)
            }
            const val = row[c.key as keyof typeof row]
            return escapeCsvField(val == null ? '' : String(val))
          })
          .join(','),
      )
      .join('\n')

    const csvString = `${header}\n${body}`
    return { data: csvString, error: null }
  } catch (e) {
    logger.error('exportPipCsv', 'Failed to export PIP CSV', undefined, e)
    return { data: null, error: e instanceof Error ? e.message : 'Failed to export PIP CSV' }
  }
}
