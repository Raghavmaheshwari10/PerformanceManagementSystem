'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { canTransition, getTransitionRequirements } from '@/lib/cycle-machine'
import { validateMultiplier } from '@/lib/validate'
import type { ActionResult, CycleStatus } from '@/lib/types'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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

  // Parse scope: department_ids and employee exclusions/inclusions
  const departmentIds = formData.getAll('department_ids') as string[]
  const excludedEmployeeIds = formData.getAll('excluded_employee_ids') as string[]
  const includedEmployeeIds = formData.getAll('included_employee_ids') as string[]

  try {
    const cycle = await prisma.cycle.create({
      data: {
        name: formData.get('name') as string,
        quarter: formData.get('quarter') as string,
        year: Number(formData.get('year')),
        sme_multiplier: smeMultiplierRaw,
        business_multiplier: businessMultiplierRaw,
        total_budget: totalBudgetRaw ? Number(totalBudgetRaw) : null,
        budget_currency: budgetCurrency,
        kpi_setting_deadline: formData.get('kpi_setting_deadline') ? new Date(formData.get('kpi_setting_deadline') as string) : null,
        self_review_deadline: formData.get('self_review_deadline') ? new Date(formData.get('self_review_deadline') as string) : null,
        manager_review_deadline: formData.get('manager_review_deadline') ? new Date(formData.get('manager_review_deadline') as string) : null,
        calibration_deadline: formData.get('calibration_deadline') ? new Date(formData.get('calibration_deadline') as string) : null,
        created_by: user.id,
        fee_multiplier,
        ee_multiplier,
        me_multiplier,
      },
    })

    // Save department assignments
    if (departmentIds.length > 0) {
      await prisma.cycleDepartment.createMany({
        data: departmentIds.map(deptId => ({
          cycle_id: cycle.id,
          department_id: deptId,
          status: 'draft' as const,
        })),
      })
    }

    // Save employee exclusions
    if (excludedEmployeeIds.length > 0) {
      await prisma.cycleEmployee.createMany({
        data: excludedEmployeeIds.map(empId => ({
          cycle_id: cycle.id,
          employee_id: empId,
          excluded: true,
        })),
      })
    }

    // Save employee inclusions (from non-selected departments)
    if (includedEmployeeIds.length > 0) {
      await prisma.cycleEmployee.createMany({
        data: includedEmployeeIds.map(empId => ({
          cycle_id: cycle.id,
          employee_id: empId,
          excluded: false,
        })),
      })
    }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to create cycle' }
  }

  revalidatePath('/admin/cycles')
  redirect('/admin/cycles')
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

/**
 * Advance a specific department within a cycle to the next status.
 */
export async function advanceDepartmentStatus(
  cycleId: string,
  departmentId: string,
  currentStatus: CycleStatus
): Promise<ActionResult> {
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

  const updated = await prisma.cycleDepartment.updateMany({
    where: { cycle_id: cycleId, department_id: departmentId, status: currentStatus },
    data: { status: nextStatus },
  })

  if (updated.count === 0) {
    return { data: null, error: 'Department status has already been changed — please refresh' }
  }

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'department_status_changed',
      entity_type: 'cycle_department',
      entity_id: `${cycleId}:${departmentId}`,
      old_value: { status: currentStatus },
      new_value: { status: nextStatus },
    },
  })

  revalidatePath('/admin')
  revalidatePath('/hrbp')
  revalidatePath(`/admin/cycles/${cycleId}`)
  return { data: null, error: null }
}

/**
 * Set an employee-level status override (hold back or advance ahead of department).
 * Pass null to clear the override and return to department-based status.
 */
export async function setEmployeeStatusOverride(
  cycleId: string,
  employeeId: string,
  statusOverride: CycleStatus | null
): Promise<ActionResult> {
  const user = await requireRole(['admin', 'hrbp'])

  await prisma.cycleEmployee.upsert({
    where: { cycle_id_employee_id: { cycle_id: cycleId, employee_id: employeeId } },
    create: {
      cycle_id: cycleId,
      employee_id: employeeId,
      status_override: statusOverride,
      excluded: false,
    },
    update: { status_override: statusOverride },
  })

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: statusOverride ? 'employee_status_override_set' : 'employee_status_override_cleared',
      entity_type: 'cycle_employee',
      entity_id: `${cycleId}:${employeeId}`,
      new_value: { status_override: statusOverride },
    },
  })

  revalidatePath(`/admin/cycles/${cycleId}`)
  return { data: null, error: null }
}
