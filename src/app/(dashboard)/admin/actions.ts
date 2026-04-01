'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { canTransition, getTransitionRequirements } from '@/lib/cycle-machine'
import { notifyUsers } from '@/lib/email'
import { getScopedEmployeeWhere } from '@/lib/cycle-helpers'
import type { ActionResult, CycleStatus } from '@/lib/types'
import type { NotificationType } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createCycle(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['admin', 'hrbp'])

  const name = (formData.get('name') as string)?.trim()
  const quarter = (formData.get('quarter') as string)?.trim()
  const year = Number(formData.get('year'))

  if (!name || !quarter || !year) {
    return { data: null, error: 'Name, quarter, and year are required' }
  }

  // Parse scope: department_ids and employee exclusions/inclusions
  const departmentIds = formData.getAll('department_ids') as string[]
  const excludedEmployeeIds = formData.getAll('excluded_employee_ids') as string[]
  const includedEmployeeIds = formData.getAll('included_employee_ids') as string[]

  try {
    const cycle = await prisma.cycle.create({
      data: {
        name,
        quarter,
        year,
        kpi_setting_deadline: formData.get('kpi_setting_deadline') ? new Date(formData.get('kpi_setting_deadline') as string) : null,
        self_review_deadline: formData.get('self_review_deadline') ? new Date(formData.get('self_review_deadline') as string) : null,
        manager_review_deadline: formData.get('manager_review_deadline') ? new Date(formData.get('manager_review_deadline') as string) : null,
        calibration_deadline: formData.get('calibration_deadline') ? new Date(formData.get('calibration_deadline') as string) : null,
        created_by: user.id,
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
    // Audit log
    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'cycle_created',
        entity_type: 'cycle',
        entity_id: cycle.id,
        new_value: { name, quarter, year, departments: departmentIds.length },
      },
    })
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

  // Also advance all department statuses that are at the same phase
  await prisma.cycleDepartment.updateMany({
    where: { cycle_id: cycleId, status: currentStatus },
    data: { status: nextStatus },
  })

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

  // Send notifications for the transition
  await sendTransitionNotifications(cycleId, nextStatus, null)

  revalidatePath('/admin')
  revalidatePath('/hrbp')
  revalidatePath('/employee')
  revalidatePath('/manager')
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
      entity_id: cycleId,
      old_value: { status: currentStatus },
      new_value: { status: nextStatus },
    },
  })

  // Send notifications for the department transition
  await sendTransitionNotifications(cycleId, nextStatus, departmentId)

  revalidatePath('/admin')
  revalidatePath('/hrbp')
  revalidatePath('/employee')
  revalidatePath('/manager')
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

// ─── Transition Notification Helper ──────────────────────────────────

const STATUS_TO_NOTIFICATION: Partial<Record<CycleStatus, { type: NotificationType; roles: ('employee' | 'manager')[] }>> = {
  kpi_setting: { type: 'cycle_kpi_setting_open', roles: ['manager'] },
  self_review: { type: 'cycle_self_review_open', roles: ['employee'] },
  manager_review: { type: 'cycle_manager_review_open', roles: ['manager'] },
  published: { type: 'cycle_published', roles: ['employee'] },
}

async function sendTransitionNotifications(
  cycleId: string,
  newStatus: CycleStatus,
  departmentId: string | null
): Promise<void> {
  const config = STATUS_TO_NOTIFICATION[newStatus]
  if (!config) return

  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: { name: true, self_review_deadline: true, manager_review_deadline: true },
  })

  const baseWhere = await getScopedEmployeeWhere(cycleId)
  const deptFilter = departmentId ? { department_id: departmentId } : {}

  const users = await prisma.user.findMany({
    where: { ...baseWhere, ...deptFilter, role: { in: config.roles } },
    select: { id: true },
  })

  if (users.length === 0) return

  const deadline = newStatus === 'self_review'
    ? cycle?.self_review_deadline?.toLocaleDateString()
    : newStatus === 'manager_review'
    ? cycle?.manager_review_deadline?.toLocaleDateString()
    : undefined

  await notifyUsers(
    users.map(u => u.id),
    config.type,
    {
      cycle_name: cycle?.name ?? '',
      ...(deadline ? { deadline } : {}),
    }
  )
}
