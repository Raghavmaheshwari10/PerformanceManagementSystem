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

  const cycleId = formData.get('cycle_id') as string
  if (await areKpisFinalized(cycleId, employeeId)) {
    return { data: null, error: 'KPIs are finalized. Unlock first to make changes.' }
  }

  const rawWeight = formData.get('weight')
  const weight = rawWeight ? Number(rawWeight) : null
  if (weight !== null && !validateWeight(weight)) {
    return { data: null, error: 'Weight must be between 1 and 100' }
  }

  const title = formData.get('title') as string

  const kraId = (formData.get('kra_id') as string) || null

  // Enforce 100% KPI weight cap per KRA
  if (kraId && weight !== null) {
    const existingKpis = await prisma.kpi.findMany({
      where: { kra_id: kraId },
      select: { weight: true },
    })
    const currentTotal = existingKpis.reduce((sum, k) => sum + (k.weight ? Number(k.weight) : 0), 0)
    if (currentTotal + weight > 100) {
      const remaining = 100 - currentTotal
      return { data: null, error: remaining <= 0
        ? 'This KRA already has 100% weight allocated. Remove existing KPIs to free up weight.'
        : `Only ${remaining}% weight remaining under this KRA. Reduce the weight and try again.`
      }
    }
  }

  const insertedKpi = await prisma.kpi.create({
    data: {
      cycle_id: cycleId,
      employee_id: employeeId,
      manager_id: user.id,
      title,
      description: (formData.get('description') as string) || null,
      weight,
      kra_id: kraId,
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

  // Check finalization via the KPI's cycle
  const kpi = await prisma.kpi.findUnique({ where: { id: kpiId }, select: { cycle_id: true } })
  if (kpi && await areKpisFinalized(kpi.cycle_id, employeeId)) {
    return { data: null, error: 'KPIs are finalized. Unlock first to make changes.' }
  }

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

export async function addKra(formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['manager'])
  const employeeId = formData.get('employee_id') as string

  await requireManagerOwnership(employeeId, user.id)

  const cycleId = formData.get('cycle_id') as string
  if (await areKpisFinalized(cycleId, employeeId)) {
    return { data: null, error: 'KPIs are finalized. Unlock first to make changes.' }
  }

  const title = formData.get('title') as string
  if (!title?.trim()) {
    return { data: null, error: 'Title is required' }
  }

  const category = (formData.get('category') as string) || 'performance'
  const rawWeight = formData.get('weight')
  const weight = rawWeight ? Number(rawWeight) : null
  if (weight !== null && !validateWeight(weight)) {
    return { data: null, error: 'Weight must be between 1 and 100' }
  }

  const insertedKra = await prisma.kra.create({
    data: {
      cycle_id: cycleId,
      employee_id: employeeId,
      title,
      description: (formData.get('description') as string) || null,
      category,
      weight,
    },
    select: { id: true },
  })

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'kra_added',
      entity_type: 'kra',
      entity_id: insertedKra.id,
      new_value: { title, employee_id: employeeId, cycle_id: cycleId },
    },
  })

  revalidatePath(`/manager/${employeeId}/kpis`)
  return { data: null, error: null }
}

export async function deleteKra(kraId: string, employeeId: string): Promise<ActionResult> {
  const user = await requireRole(['manager'])
  await requireManagerOwnership(employeeId, user.id)

  // Check finalization via the KRA's cycle
  const kra = await prisma.kra.findUnique({ where: { id: kraId }, select: { cycle_id: true } })
  if (kra && await areKpisFinalized(kra.cycle_id, employeeId)) {
    return { data: null, error: 'KPIs are finalized. Unlock first to make changes.' }
  }

  // Detach child KPIs (set kra_id to null) before deleting the KRA
  await prisma.kpi.updateMany({
    where: { kra_id: kraId },
    data: { kra_id: null },
  })

  await prisma.kra.delete({ where: { id: kraId } })

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'kra_deleted',
      entity_type: 'kra',
      entity_id: kraId,
      old_value: { kra_id: kraId },
    },
  })

  revalidatePath(`/manager/${employeeId}/kpis`)
  return { data: null, error: null }
}

// Helper: check if KPIs are finalized for an employee+cycle
export async function areKpisFinalized(cycleId: string, employeeId: string): Promise<boolean> {
  const entry = await prisma.auditLog.findFirst({
    where: {
      entity_type: 'kpi_finalization',
      entity_id: `${cycleId}:${employeeId}`,
      action: { in: ['kpis_finalized', 'kpis_unfinalized'] },
    },
    orderBy: { created_at: 'desc' },
    select: { action: true },
  })
  return entry?.action === 'kpis_finalized'
}

export async function finalizeKpis(formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['manager'])
  const employeeId = formData.get('employee_id') as string
  const cycleId = formData.get('cycle_id') as string

  await requireManagerOwnership(employeeId, user.id)

  // Validate: at least one KRA with KPIs
  const kras = await prisma.kra.findMany({
    where: { cycle_id: cycleId, employee_id: employeeId },
    include: { kpis: { select: { weight: true } } },
  })

  if (kras.length === 0) {
    return { data: null, error: 'Create at least one KRA before finalizing.' }
  }

  const kraWithoutKpis = kras.find(k => k.kpis.length === 0)
  if (kraWithoutKpis) {
    return { data: null, error: `KRA "${kraWithoutKpis.title}" has no KPIs. Add at least one KPI to each KRA.` }
  }

  // Check all KRAs have KPI weights summing to 100%
  for (const kra of kras) {
    const kpiTotal = kra.kpis.reduce((sum, k) => sum + (k.weight ? Number(k.weight) : 0), 0)
    if (kpiTotal !== 100) {
      return { data: null, error: `KRA "${kra.title}" has KPI weights totaling ${kpiTotal}% (must be 100%).` }
    }
  }

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'kpis_finalized',
      entity_type: 'kpi_finalization',
      entity_id: `${cycleId}:${employeeId}`,
      new_value: { cycle_id: cycleId, employee_id: employeeId },
    },
  })

  revalidatePath(`/manager/${employeeId}/kpis`)
  return { data: null, error: null }
}

export async function unfinalizeKpis(formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['manager'])
  const employeeId = formData.get('employee_id') as string
  const cycleId = formData.get('cycle_id') as string

  await requireManagerOwnership(employeeId, user.id)

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'kpis_unfinalized',
      entity_type: 'kpi_finalization',
      entity_id: `${cycleId}:${employeeId}`,
      new_value: { cycle_id: cycleId, employee_id: employeeId },
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
