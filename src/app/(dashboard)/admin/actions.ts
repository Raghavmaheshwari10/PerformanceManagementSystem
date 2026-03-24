'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { canTransition, getTransitionRequirements } from '@/lib/cycle-machine'
import { validateMultiplier } from '@/lib/validate'
import type { ActionResult, CycleStatus } from '@/lib/types'
import { revalidatePath } from 'next/cache'

export async function createCycle(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['admin', 'hrbp'])

  const smeMultiplierRaw = Number(formData.get('sme_multiplier'))
  if (!validateMultiplier(smeMultiplierRaw)) {
    return { data: null, error: 'SME multiplier must be between 0 and 5' }
  }

  const businessMultiplierRaw = Number(formData.get('business_multiplier') ?? 1.0)
  if (businessMultiplierRaw < 0 || businessMultiplierRaw > 2.0) {
    return { data: null, error: 'Business multiplier must be between 0 and 2.0' }
  }
  const totalBudgetRaw = formData.get('total_budget') as string
  const budgetCurrency = (formData.get('budget_currency') as string) || 'INR'

  const fee_multiplier = formData.get('fee_multiplier')
    ? parseFloat(formData.get('fee_multiplier') as string)
    : null
  const ee_multiplier = formData.get('ee_multiplier')
    ? parseFloat(formData.get('ee_multiplier') as string)
    : null
  const me_multiplier = formData.get('me_multiplier')
    ? parseFloat(formData.get('me_multiplier') as string)
    : null

  if (fee_multiplier !== null && !validateMultiplier(fee_multiplier)) {
    return { data: null, error: 'FEE multiplier override must be between 0 and 5' }
  }
  if (ee_multiplier !== null && !validateMultiplier(ee_multiplier)) {
    return { data: null, error: 'EE multiplier override must be between 0 and 5' }
  }
  if (me_multiplier !== null && !validateMultiplier(me_multiplier)) {
    return { data: null, error: 'ME multiplier override must be between 0 and 5' }
  }

  try {
    await prisma.cycle.create({
      data: {
        name: formData.get('name') as string,
        quarter: formData.get('quarter') as string,
        year: Number(formData.get('year')),
        sme_multiplier: smeMultiplierRaw,
        business_multiplier: businessMultiplierRaw,
        total_budget: totalBudgetRaw ? Number(totalBudgetRaw) : null,
        budget_currency: budgetCurrency,
        kpi_setting_deadline: (formData.get('kpi_setting_deadline') as string) || null,
        self_review_deadline: (formData.get('self_review_deadline') as string) || null,
        manager_review_deadline: (formData.get('manager_review_deadline') as string) || null,
        calibration_deadline: (formData.get('calibration_deadline') as string) || null,
        created_by: user.id,
        fee_multiplier,
        ee_multiplier,
        me_multiplier,
      },
    })
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to create cycle' }
  }

  revalidatePath('/admin')
  return { data: null, error: null }
}

export async function advanceCycleStatus(cycleId: string, currentStatus: CycleStatus): Promise<ActionResult> {
  const user = await requireRole(['admin', 'hrbp'])

  const nextMap: Record<string, CycleStatus> = {
    draft: 'kpi_setting',
    kpi_setting: 'self_review',
    self_review: 'manager_review',
    manager_review: 'calibrating',
    calibrating: 'locked',
    locked: 'published',
  }
  const nextStatus = nextMap[currentStatus]
  if (!nextStatus || !canTransition(currentStatus, nextStatus)) {
    return { data: null, error: `Cannot advance from ${currentStatus}` }
  }

  const req = getTransitionRequirements(currentStatus, nextStatus)
  if (!req?.allowedRoles.includes(user.role)) {
    return { data: null, error: 'Not authorized for this transition' }
  }

  // Atomic check-and-set: only update if status is still currentStatus
  const updateData: Record<string, unknown> = {
    status: nextStatus,
    updated_at: new Date(),
  }
  if (nextStatus === 'published') {
    updateData.published_at = new Date()
  }

  const updated = await prisma.cycle.updateMany({
    where: { id: cycleId, status: currentStatus },
    data: updateData,
  })

  if (updated.count === 0) {
    return { data: null, error: 'Cycle status has already been changed by another user — please refresh' }
  }

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'cycle_status_changed',
      entity_type: 'cycle',
      entity_id: cycleId,
      old_value: { status: currentStatus },
      new_value: { status: nextStatus },
    },
  })

  revalidatePath('/admin')
  revalidatePath('/hrbp')
  return { data: null, error: null }
}
