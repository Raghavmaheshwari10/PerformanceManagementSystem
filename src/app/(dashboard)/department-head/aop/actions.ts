'use server'

import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { upsertEmployeeAop, lockDepartmentCascade } from '@/lib/db/aop'
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
          type: 'admin_message' as const,
          payload: {
            title: 'AOP Targets Locked',
            body: `Your ${deptAop.org_aop.metric.replace(/_/g, ' ')} targets for ${deptAop.org_aop.fiscal_year} have been locked by your department head.`,
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
