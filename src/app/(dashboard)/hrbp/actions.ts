'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { getPayoutMultiplier } from '@/lib/constants'
import { bulkLockAppraisals } from '@/lib/db/appraisals'
import type { ActionResult, RatingTier } from '@/lib/types'
import { revalidatePath } from 'next/cache'

export async function overrideRating(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['hrbp'])

  const appraisalId = formData.get('appraisal_id') as string
  const cycleId = formData.get('cycle_id') as string
  const newRating = formData.get('final_rating') as RatingTier
  const justification = formData.get('justification') as string

  if (!justification?.trim()) return { data: null, error: 'Justification is required for rating overrides' }

  const appraisal = await prisma.appraisal.findUnique({
    where: { id: appraisalId },
    include: { cycle: { select: { sme_multiplier: true } } },
  })

  if (!appraisal) return { data: null, error: 'Appraisal not found' }

  // Cross-cycle guard: ensure the appraisal belongs to the requested cycle
  if (appraisal.cycle_id !== cycleId) return { data: null, error: 'Appraisal does not belong to this cycle' }

  const smeMultiplier = Number(appraisal.cycle?.sme_multiplier ?? 0)
  const multiplier = getPayoutMultiplier(newRating, smeMultiplier)

  const employee = await prisma.user.findUnique({
    where: { id: appraisal.employee_id },
    select: { variable_pay: true },
  })

  const payoutAmount = Number(employee?.variable_pay ?? 0) * multiplier

  // Optimistic lock: only update if is_final is still false
  const updated = await prisma.appraisal.updateMany({
    where: { id: appraisalId, is_final: false },
    data: {
      final_rating: newRating as import('@prisma/client').RatingTier,
      final_rating_set_by: user.id,
      payout_multiplier: multiplier,
      payout_amount: payoutAmount,
      is_final: true,
    },
  })

  if (updated.count === 0) return { data: null, error: 'This appraisal has already been finalised by another user' }

  await prisma.auditLog.create({
    data: {
      cycle_id: appraisal.cycle_id,
      changed_by: user.id,
      action: 'rating_override',
      entity_type: 'appraisal',
      entity_id: appraisalId,
      old_value: { final_rating: appraisal.final_rating },
      new_value: { final_rating: newRating },
      justification,
    },
  })

  revalidatePath('/hrbp/calibration')
  return { data: null, error: null }
}

export async function lockCycle(cycleId: string): Promise<ActionResult> {
  const user = await requireRole(['hrbp'])

  try {
    await bulkLockAppraisals(cycleId)
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to lock appraisals' }
  }

  await prisma.cycle.update({
    where: { id: cycleId },
    data: { status: 'locked', updated_at: new Date() },
  })

  await prisma.auditLog.create({
    data: {
      cycle_id: cycleId,
      changed_by: user.id,
      action: 'cycle_locked',
      entity_type: 'cycle',
      entity_id: cycleId,
      new_value: { status: 'locked' },
    },
  })

  revalidatePath('/hrbp')
  return { data: null, error: null }
}

export async function publishCycle(cycleId: string): Promise<ActionResult> {
  const user = await requireRole(['hrbp'])

  // Guard: cycle must be locked before publishing
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: { status: true },
  })

  if (!cycle || cycle.status !== 'locked') {
    return { data: null, error: 'Cycle must be locked before it can be published' }
  }

  await prisma.cycle.update({
    where: { id: cycleId },
    data: {
      status: 'published',
      published_at: new Date(),
      updated_at: new Date(),
    },
  })

  const employees = await prisma.user.findMany({
    where: { is_active: true },
    select: { id: true },
  })
  const notifications = employees.map(e => ({
    recipient_id: e.id,
    type: 'cycle_published' as const,
    payload: { cycle_id: cycleId },
  }))
  if (notifications.length) {
    await prisma.notification.createMany({ data: notifications })
  }

  await prisma.auditLog.create({
    data: {
      cycle_id: cycleId,
      changed_by: user.id,
      action: 'cycle_published',
      entity_type: 'cycle',
      entity_id: cycleId,
      new_value: { status: 'published' },
    },
  })

  revalidatePath('/hrbp')
  return { data: null, error: null }
}
