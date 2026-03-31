'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import type { GoalType } from '@prisma/client'

export async function createGoal(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['employee'])

  const cycleId = formData.get('cycle_id') as string
  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const goal_type = (formData.get('goal_type') as GoalType) || 'business'
  const target_value = parseFloat(formData.get('target_value') as string) || null
  const unit = (formData.get('unit') as string)?.trim() || null
  const weight = parseFloat(formData.get('weight') as string) || null
  const due_date = (formData.get('due_date') as string) || null

  if (!title) return { data: null, error: 'Title is required' }
  if (!cycleId) return { data: null, error: 'No active cycle' }

  const goal = await prisma.goal.create({
    data: {
      cycle_id: cycleId,
      employee_id: user.id,
      title,
      description,
      goal_type,
      target_value,
      unit,
      weight,
      due_date: due_date ? new Date(due_date) : null,
      status: 'draft',
    },
    select: { id: true },
  })

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'goal_created',
      entity_type: 'goal',
      entity_id: goal.id,
      new_value: { title, cycle_id: cycleId },
    },
  })

  revalidatePath('/employee/goals')
  return { data: null, error: null }
}

export async function submitGoal(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['employee'])
  const goalId = formData.get('goal_id') as string

  const goal = await prisma.goal.findUnique({ where: { id: goalId }, select: { employee_id: true, status: true } })
  if (!goal || goal.employee_id !== user.id) return { data: null, error: 'Goal not found' }
  if (goal.status !== 'draft') return { data: null, error: 'Only draft goals can be submitted' }

  await prisma.goal.update({ where: { id: goalId }, data: { status: 'submitted', updated_at: new Date() } })

  await prisma.auditLog.create({
    data: { changed_by: user.id, action: 'goal_submitted', entity_type: 'goal', entity_id: goalId },
  })

  revalidatePath('/employee/goals')
  return { data: null, error: null }
}

export async function updateGoalProgress(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['employee'])
  const goalId = formData.get('goal_id') as string
  const newValue = parseFloat(formData.get('new_value') as string)
  const note = (formData.get('note') as string)?.trim() || null

  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    select: { employee_id: true, current_value: true, status: true },
  })
  if (!goal || goal.employee_id !== user.id) return { data: null, error: 'Goal not found' }
  if (!['approved', 'completed'].includes(goal.status)) return { data: null, error: 'Can only update approved goals' }

  await prisma.$transaction([
    prisma.goal.update({
      where: { id: goalId },
      data: { current_value: newValue, updated_at: new Date() },
    }),
    prisma.goalUpdate.create({
      data: {
        goal_id: goalId,
        updated_by: user.id,
        previous_value: goal.current_value,
        new_value: newValue,
        note,
      },
    }),
  ])

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'goal_progress_updated',
      entity_type: 'goal',
      entity_id: goalId,
      new_value: { previous_value: goal.current_value ? Number(goal.current_value) : null, new_value: newValue, note },
    },
  })

  revalidatePath('/employee/goals')
  revalidatePath(`/employee/goals/${goalId}`)
  return { data: null, error: null }
}
