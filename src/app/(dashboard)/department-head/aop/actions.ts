'use server'

import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { upsertEmployeeAop, lockDepartmentCascade, markEmployeeExited, createReplacementAop } from '@/lib/db/aop'
import { revalidatePath } from 'next/cache'
import { createKpisFromCascade } from '@/lib/aop-kpi-sync'
import type { ActionResult } from '@/lib/types'

const MONTHS = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'] as const
type MonthKey = (typeof MONTHS)[number]

function parseMonthly(formData: FormData, prefix: string): Record<MonthKey, number> | { error: string } {
  const result = {} as Record<MonthKey, number>
  for (const m of MONTHS) {
    const val = Number(formData.get(`${prefix}${m}`))
    if (isNaN(val) || val < 0) return { error: `Invalid value for ${m}` }
    result[m] = val
  }
  return result
}

export async function saveEmployeeCascade(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['department_head'])

  const department_aop_id = (formData.get('department_aop_id') as string)?.trim()
  if (!department_aop_id) return { data: null, error: 'Department AOP ID is required' }

  // Verify the department AOP belongs to this user's department
  const deptAop = await prisma.departmentAop.findUnique({
    where: { id: department_aop_id },
    include: { org_aop: true },
  })
  if (!deptAop) return { data: null, error: 'Department AOP record not found' }
  if (deptAop.department_id !== user.department_id) {
    return { data: null, error: 'You can only cascade targets for your own department' }
  }
  if (deptAop.status === 'locked') {
    return { data: null, error: 'Targets are already locked and cannot be edited' }
  }

  // Get employee IDs from form
  const employeeIdsStr = (formData.get('employee_ids') as string)?.trim()
  if (!employeeIdsStr) return { data: null, error: 'No employees provided' }
  const employeeIds = employeeIdsStr.split(',')

  try {
    for (const empId of employeeIds) {
      const annual = Number(formData.get(`emp_${empId}_annual`))
      if (isNaN(annual) || annual < 0) {
        return { data: null, error: `Invalid annual target for employee ${empId}` }
      }

      // Skip employees with 0 annual (not yet filled in)
      if (annual === 0) {
        const monthly = parseMonthly(formData, `emp_${empId}_`)
        if ('error' in monthly) return { data: null, error: monthly.error }
        const allZero = MONTHS.every((m) => monthly[m] === 0)
        if (allZero) continue // Skip fully empty rows
      }

      const monthly = parseMonthly(formData, `emp_${empId}_`)
      if ('error' in monthly) return { data: null, error: monthly.error }

      await upsertEmployeeAop({
        department_aop_id,
        employee_id: empId,
        annual_target: annual,
        monthly,
      })
    }

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'aop_employee_cascade',
        entity_type: 'department_aop',
        entity_id: department_aop_id,
        new_value: { employee_ids: employeeIds },
      },
    })
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to save employee cascade' }
  }

  revalidatePath('/department-head/aop')
  return { data: null, error: null }
}

export async function lockCascade(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['department_head'])

  const department_aop_id = (formData.get('department_aop_id') as string)?.trim()
  if (!department_aop_id) return { data: null, error: 'Department AOP ID is required' }

  // Verify ownership
  const deptAop = await prisma.departmentAop.findUnique({
    where: { id: department_aop_id },
    include: { org_aop: true },
  })
  if (!deptAop) return { data: null, error: 'Department AOP record not found' }
  if (deptAop.department_id !== user.department_id) {
    return { data: null, error: 'You can only lock targets for your own department' }
  }
  if (deptAop.status === 'locked') {
    return { data: null, error: 'Targets are already locked' }
  }

  try {
    // lockDepartmentCascade validates 100% allocation and sets status='locked'
    await lockDepartmentCascade(department_aop_id)

    // Notify each employee in the department about their targets
    const employeeAops = await prisma.employeeAop.findMany({
      where: { department_aop_id },
      select: { employee_id: true },
    })

    if (employeeAops.length > 0) {
      await prisma.notification.createMany({
        data: employeeAops.map((ea) => ({
          recipient_id: ea.employee_id,
          type: 'aop_employee_targets_set' as const,
          payload: {
            title: 'AOP Targets Locked',
            body: `Your ${deptAop.org_aop.metric.replace(/_/g, ' ')} targets for ${deptAop.org_aop.fiscal_year} have been locked by your department head.`,
            fiscal_year: deptAop.org_aop.fiscal_year,
            metric: deptAop.org_aop.metric,
          },
        })),
      })
    }

    // Notify all admin/superadmin users about the cascade lock
    const dept = await prisma.department.findUnique({
      where: { id: deptAop.department_id },
      select: { name: true },
    })
    const deptName = dept?.name ?? deptAop.department_id
    const admins = await prisma.user.findMany({
      where: { role: { in: ['admin', 'superadmin'] }, is_active: true },
      select: { id: true },
    })
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          recipient_id: a.id,
          type: 'aop_cascade_locked' as const,
          payload: {
            title: 'AOP Cascade Locked',
            body: `${deptName} department has locked their ${deptAop.org_aop.metric.replace(/_/g, ' ')} targets for FY ${deptAop.org_aop.fiscal_year}.`,
            department_name: deptName,
            fiscal_year: deptAop.org_aop.fiscal_year,
            metric: deptAop.org_aop.metric,
          },
        })),
      })
    }

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'aop_cascade_locked',
        entity_type: 'department_aop',
        entity_id: department_aop_id,
        new_value: {
          fiscal_year: deptAop.org_aop.fiscal_year,
          metric: deptAop.org_aop.metric,
          employee_count: employeeAops.length,
        },
      },
    })

    // Auto-create KPIs for each active cycle in this fiscal year
    const activeCycles = await prisma.cycle.findMany({
      where: {
        fiscal_year: deptAop.org_aop.fiscal_year,
        status: { not: 'published' },
      },
    })

    for (const cycle of activeCycles) {
      await createKpisFromCascade(department_aop_id, cycle.id)
    }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to lock cascade' }
  }

  revalidatePath('/department-head/aop')
  return { data: null, error: null }
}

export async function markExit(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['department_head'])

  const employee_aop_id = (formData.get('employee_aop_id') as string)?.trim()
  const exited_at_str = (formData.get('exited_at') as string)?.trim()

  if (!employee_aop_id) return { data: null, error: 'Employee AOP ID is required' }
  if (!exited_at_str) return { data: null, error: 'Exit date is required' }

  const exitedAt = new Date(exited_at_str)
  if (isNaN(exitedAt.getTime())) return { data: null, error: 'Invalid exit date' }

  // Verify the employee AOP belongs to this department head's department
  const empAop = await prisma.employeeAop.findUnique({
    where: { id: employee_aop_id },
    include: { department_aop: { include: { org_aop: true } } },
  })
  if (!empAop) return { data: null, error: 'Employee AOP record not found' }
  if (empAop.department_aop.department_id !== user.department_id) {
    return { data: null, error: 'You can only manage exits for your own department' }
  }
  if (empAop.exited_at) return { data: null, error: 'Employee has already been marked as exited' }

  try {
    await markEmployeeExited(employee_aop_id, exitedAt)
    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'aop_employee_exited',
        entity_type: 'employee_aop',
        entity_id: employee_aop_id,
        new_value: { exited_at: exitedAt.toISOString() },
      },
    })
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to mark employee as exited' }
  }

  revalidatePath('/department-head/aop')
  return { data: null, error: null }
}

export async function assignReplacement(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['department_head'])

  const original_employee_aop_id = (formData.get('original_employee_aop_id') as string)?.trim()
  const replacement_employee_id = (formData.get('replacement_employee_id') as string)?.trim()

  if (!original_employee_aop_id) return { data: null, error: 'Original employee AOP ID is required' }
  if (!replacement_employee_id) return { data: null, error: 'Replacement employee ID is required' }

  // Verify the original employee AOP belongs to this department
  const originalEmpAop = await prisma.employeeAop.findUnique({
    where: { id: original_employee_aop_id },
    include: { department_aop: { include: { org_aop: true } } },
  })
  if (!originalEmpAop) return { data: null, error: 'Original employee AOP record not found' }
  if (originalEmpAop.department_aop.department_id !== user.department_id) {
    return { data: null, error: 'You can only manage replacements for your own department' }
  }
  if (!originalEmpAop.exited_at) {
    return { data: null, error: 'Original employee must be marked as exited before assigning a replacement' }
  }

  // Parse monthly targets for replacement
  const MONTH_KEYS = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'] as const
  const monthly = {} as Record<(typeof MONTH_KEYS)[number], number>
  for (const m of MONTH_KEYS) {
    monthly[m] = Number(formData.get(`monthly_${m}`) ?? 0)
  }

  try {
    const newEmpAop = await createReplacementAop({
      original_employee_aop_id,
      replacement_employee_id,
      monthly,
    })

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'aop_replacement_assigned',
        entity_type: 'employee_aop',
        entity_id: newEmpAop.id,
        new_value: {
          original_employee_aop_id,
          replacement_employee_id,
        },
      },
    })

    // Auto-create KPIs for the replacement employee in active cycles
    const activeCycles = await prisma.cycle.findMany({
      where: {
        fiscal_year: originalEmpAop.department_aop.org_aop.fiscal_year,
        status: { not: 'published' },
      },
    })
    for (const cycle of activeCycles) {
      await createKpisFromCascade(originalEmpAop.department_aop_id, cycle.id)
    }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to assign replacement' }
  }

  revalidatePath('/department-head/aop')
  return { data: null, error: null }
}
