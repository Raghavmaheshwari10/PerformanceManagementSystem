'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import { dispatchPendingNotifications } from '@/lib/email'
import { getCycleDepartmentIds } from '@/lib/cycle-helpers'

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
    dispatchPendingNotifications(u.id).catch(console.error)
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
    dispatchPendingNotifications(id).catch(console.error)
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
