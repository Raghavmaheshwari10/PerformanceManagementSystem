'use server'

import { prisma } from '@/lib/prisma'
import { requireRole, requireManagerOwnership } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function approveGoal(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const manager = await requireRole(['manager'])
  const goalId = formData.get('goal_id') as string

  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    select: { employee_id: true, status: true },
  })
  if (!goal) return { data: null, error: 'Goal not found' }
  await requireManagerOwnership(goal.employee_id, manager.id)
  if (goal.status !== 'submitted') return { data: null, error: 'Goal is not pending approval' }

  await prisma.goal.update({
    where: { id: goalId },
    data: { status: 'approved', approved_by: manager.id, approved_at: new Date(), updated_at: new Date() },
  })

  await prisma.auditLog.create({
    data: { changed_by: manager.id, action: 'goal_approved', entity_type: 'goal', entity_id: goalId },
  })

  revalidatePath(`/manager/${goal.employee_id}/goals`)
  return { data: null, error: null }
}

export async function rejectGoal(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const manager = await requireRole(['manager'])
  const goalId = formData.get('goal_id') as string
  const comment = (formData.get('manager_comment') as string)?.trim()

  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    select: { employee_id: true, status: true },
  })
  if (!goal) return { data: null, error: 'Goal not found' }
  await requireManagerOwnership(goal.employee_id, manager.id)

  await prisma.goal.update({
    where: { id: goalId },
    data: { status: 'rejected', manager_comment: comment || null, updated_at: new Date() },
  })

  await prisma.auditLog.create({
    data: {
      changed_by: manager.id, action: 'goal_rejected', entity_type: 'goal', entity_id: goalId,
      new_value: { comment },
    },
  })

  revalidatePath(`/manager/${goal.employee_id}/goals`)
  return { data: null, error: null }
}
