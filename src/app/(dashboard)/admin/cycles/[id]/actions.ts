'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import { dispatchPendingNotifications } from '@/lib/email'
import logger from '@/lib/logger'
import { getCycleDepartmentIds } from '@/lib/cycle-helpers'
import { getNextStatus } from '@/lib/cycle-machine'
import type { CycleStatus } from '@/lib/types'

export async function sendSelfReviewReminders(cycleId: string): Promise<ActionResult<{ sent: number }>> {
  const user = await requireRole(['admin'])

  const deptIds = await getCycleDepartmentIds(cycleId)
  const deptFilter = deptIds.length > 0 ? { department_id: { in: deptIds } } : {}
  const allActive = await prisma.user.findMany({
    where: { is_active: true, role: 'employee', ...deptFilter },
    select: { id: true },
  })
  const submitted = await prisma.review.findMany({
    where: { cycle_id: cycleId, status: 'submitted' },
    select: { employee_id: true },
  })

  const submittedIds = new Set(submitted.map(r => r.employee_id))
  const pending = allActive.filter(u => !submittedIds.has(u.id))

  if (pending.length === 0) return { data: { sent: 0 }, error: null }

  await prisma.notification.createMany({
    data: pending.map(u => ({
      recipient_id: u.id,
      type: 'review_reminder' as const,
      payload: { cycle_id: cycleId, kind: 'self_review' },
    })),
  })

  for (const u of pending) {
    dispatchPendingNotifications(u.id).catch(err => logger.error('dispatchNotifications', 'Failed to dispatch pending notifications', { userId: u.id }, err))
  }

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'send_reminders',
      entity_type: 'cycle',
      entity_id: cycleId,
      new_value: { kind: 'self_review', count: pending.length },
    },
  })

  revalidatePath(`/admin/cycles/${cycleId}`)
  return { data: { sent: pending.length }, error: null }
}

export async function updateCycleDepartments(
  cycleId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['admin'])
  const departmentIds = formData.getAll('department_ids') as string[]

  try {
    await prisma.$transaction(async (tx) => {
      await tx.cycleDepartment.deleteMany({ where: { cycle_id: cycleId } })
      if (departmentIds.length > 0) {
        await tx.cycleDepartment.createMany({
          data: departmentIds.map(id => ({ cycle_id: cycleId, department_id: id })),
        })
      }
    })
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to update departments' }
  }

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'cycle_departments_updated',
      entity_type: 'cycle',
      entity_id: cycleId,
      new_value: { department_ids: departmentIds },
    },
  })

  revalidatePath(`/admin/cycles/${cycleId}`)
  return { data: null, error: null }
}

export async function sendManagerReviewReminders(cycleId: string): Promise<ActionResult<{ sent: number }>> {
  const user = await requireRole(['admin'])

  const mgrDeptIds = await getCycleDepartmentIds(cycleId)
  const mgrDeptFilter = mgrDeptIds.length > 0
    ? { employee: { department_id: { in: mgrDeptIds } } }
    : {}
  const appraisals = await prisma.appraisal.findMany({
    where: { cycle_id: cycleId, ...mgrDeptFilter },
    select: { manager_id: true, manager_submitted_at: true },
  })

  const pendingManagerIds = [...new Set(
    appraisals.filter(a => !a.manager_submitted_at).map(a => a.manager_id)
  )]

  if (pendingManagerIds.length === 0) return { data: { sent: 0 }, error: null }

  await prisma.notification.createMany({
    data: pendingManagerIds.map(id => ({
      recipient_id: id,
      type: 'review_reminder' as const,
      payload: { cycle_id: cycleId, kind: 'manager_review' },
    })),
  })

  for (const id of pendingManagerIds) {
    dispatchPendingNotifications(id).catch(err => logger.error('dispatchNotifications', 'Failed to dispatch pending notifications', { userId: id }, err))
  }

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'send_reminders',
      entity_type: 'cycle',
      entity_id: cycleId,
      new_value: { kind: 'manager_review', count: pendingManagerIds.length },
    },
  })

  revalidatePath(`/admin/cycles/${cycleId}`)
  return { data: { sent: pendingManagerIds.length }, error: null }
}

export async function bulkAdvanceDepartments(
  cycleId: string,
  departmentIds: string[],
  currentStatus: CycleStatus,
): Promise<ActionResult<{ advanced: number }>> {
  const user = await requireRole(['admin'])

  const nextStatus = getNextStatus(currentStatus)
  if (!nextStatus) return { data: null, error: `Cannot advance from "${currentStatus}" — no next status.` }

  if (departmentIds.length === 0) return { data: null, error: 'No departments selected.' }

  // Only advance departments that are actually at the expected current status
  const result = await prisma.cycleDepartment.updateMany({
    where: {
      cycle_id: cycleId,
      department_id: { in: departmentIds },
      status: currentStatus as Parameters<typeof prisma.cycleDepartment.updateMany>[0]['where'] extends { status?: infer S } ? S : never,
    },
    data: {
      status: nextStatus as Parameters<typeof prisma.cycleDepartment.updateMany>[0]['where'] extends { status?: infer S } ? S : never,
    },
  })

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'bulk_advance_departments',
      entity_type: 'cycle',
      entity_id: cycleId,
      new_value: {
        from: currentStatus,
        to: nextStatus,
        department_ids: departmentIds,
        advanced: result.count,
      },
    },
  })

  revalidatePath(`/admin/cycles/${cycleId}`)
  return { data: { advanced: result.count }, error: null }
}

export async function bulkSendReminders(
  cycleId: string,
  departmentIds: string[],
  status: CycleStatus,
): Promise<ActionResult<{ sent: number }>> {
  const user = await requireRole(['admin'])

  if (departmentIds.length === 0) return { data: null, error: 'No departments selected.' }

  // Find pending employees based on the current status
  let pendingUserIds: string[] = []

  if (status === 'kpi_setting') {
    // Employees with no KPIs set for this cycle in selected departments
    const employees = await prisma.user.findMany({
      where: { is_active: true, department_id: { in: departmentIds } },
      select: { id: true },
    })
    const withKpis = await prisma.kpi.findMany({
      where: { cycle_id: cycleId, employee_id: { in: employees.map(e => e.id) } },
      select: { employee_id: true },
      distinct: ['employee_id'],
    })
    const withKpiSet = new Set(withKpis.map(k => k.employee_id))
    pendingUserIds = employees.filter(e => !withKpiSet.has(e.id)).map(e => e.id)
  } else if (status === 'self_review') {
    // Employees who haven't submitted self-review
    const employees = await prisma.user.findMany({
      where: { is_active: true, department_id: { in: departmentIds } },
      select: { id: true },
    })
    const submitted = await prisma.review.findMany({
      where: { cycle_id: cycleId, employee_id: { in: employees.map(e => e.id) }, status: 'submitted' },
      select: { employee_id: true },
    })
    const submittedIds = new Set(submitted.map(r => r.employee_id))
    pendingUserIds = employees.filter(e => !submittedIds.has(e.id)).map(e => e.id)
  } else if (status === 'manager_review') {
    // Managers who haven't submitted appraisals for employees in selected departments
    const appraisals = await prisma.appraisal.findMany({
      where: {
        cycle_id: cycleId,
        employee: { department_id: { in: departmentIds } },
      },
      select: { manager_id: true, manager_submitted_at: true },
    })
    pendingUserIds = [...new Set(
      appraisals.filter(a => !a.manager_submitted_at).map(a => a.manager_id)
    )]
  } else {
    return { data: { sent: 0 }, error: null }
  }

  if (pendingUserIds.length === 0) return { data: { sent: 0 }, error: null }

  await prisma.notification.createMany({
    data: pendingUserIds.map(id => ({
      recipient_id: id,
      type: 'review_reminder' as const,
      payload: { cycle_id: cycleId, kind: status },
    })),
  })

  for (const id of pendingUserIds) {
    dispatchPendingNotifications(id).catch(err =>
      logger.error('dispatchNotifications', 'Failed to dispatch pending notifications', { userId: id }, err)
    )
  }

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'send_reminders',
      entity_type: 'cycle',
      entity_id: cycleId,
      new_value: { kind: `bulk_${status}`, department_ids: departmentIds, count: pendingUserIds.length },
    },
  })

  revalidatePath(`/admin/cycles/${cycleId}`)
  return { data: { sent: pendingUserIds.length }, error: null }
}
