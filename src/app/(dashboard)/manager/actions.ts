'use server'

import { prisma } from '@/lib/prisma'
import { requireRole, requireManagerOwnership } from '@/lib/auth'
import { validateWeight } from '@/lib/validate'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import type { RatingTier } from '@prisma/client'

export async function addKpi(formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['manager'])
  const employeeId = formData.get('employee_id') as string

  await requireManagerOwnership(employeeId, user.id)

  const rawWeight = formData.get('weight')
  const weight = rawWeight ? Number(rawWeight) : null
  if (weight !== null && !validateWeight(weight)) {
    return { data: null, error: 'Weight must be between 1 and 100' }
  }

  const title = formData.get('title') as string
  const cycleId = formData.get('cycle_id') as string

  const insertedKpi = await prisma.kpi.create({
    data: {
      cycle_id: cycleId,
      employee_id: employeeId,
      manager_id: user.id,
      title,
      description: (formData.get('description') as string) || null,
      weight,
    },
    select: { id: true },
  })

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'kpi_added',
      entity_type: 'kpi',
      entity_id: insertedKpi.id,
      new_value: { title, employee_id: employeeId, cycle_id: cycleId },
    },
  })

  revalidatePath(`/manager/${employeeId}/kpis`)
  return { data: null, error: null }
}

export async function deleteKpi(kpiId: string, employeeId: string): Promise<ActionResult> {
  const user = await requireRole(['manager'])
  await requireManagerOwnership(employeeId, user.id)

  await prisma.kpi.delete({ where: { id: kpiId } })

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'kpi_deleted',
      entity_type: 'kpi',
      entity_id: kpiId,
      old_value: { kpi_id: kpiId },
    },
  })

  revalidatePath(`/manager/${employeeId}/kpis`)
  return { data: null, error: null }
}

export async function submitManagerRating(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['manager'])
  const employeeId = formData.get('employee_id') as string

  await requireManagerOwnership(employeeId, user.id)

  const cycleId = formData.get('cycle_id') as string

  // Deadline check: cycle must be in manager_review status and deadline not passed
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: { status: true, manager_review_deadline: true },
  })

  if (!cycle || cycle.status !== 'manager_review') {
    return { data: null, error: 'Cycle is not in manager review phase' }
  }
  if (cycle.manager_review_deadline && new Date() > new Date(cycle.manager_review_deadline)) {
    return { data: null, error: 'Manager review deadline has passed — contact your HRBP' }
  }

  const rating = formData.get('manager_rating') as string
  const comments = formData.get('manager_comments') as string

  await prisma.appraisal.upsert({
    where: { cycle_id_employee_id: { cycle_id: cycleId, employee_id: employeeId } },
    update: {
      manager_rating: rating as RatingTier,
      manager_comments: comments,
      manager_submitted_at: new Date(),
      updated_at: new Date(),
    },
    create: {
      cycle_id: cycleId,
      employee_id: employeeId,
      manager_id: user.id,
      manager_rating: rating as RatingTier,
      manager_comments: comments,
      manager_submitted_at: new Date(),
    },
  })

  // Notify all HRBPs that manager has submitted a rating
  const hrbps = await prisma.user.findMany({
    where: { role: 'hrbp', is_active: true },
    select: { id: true },
  })
  if (hrbps.length > 0) {
    await prisma.notification.createMany({
      data: hrbps.map(h => ({
        recipient_id: h.id,
        type: 'manager_review_submitted' as const,
        payload: { cycle_id: cycleId, employee_id: employeeId, manager_id: user.id },
      })),
    })
  }

  revalidatePath('/manager')
  return { data: null, error: null }
}
