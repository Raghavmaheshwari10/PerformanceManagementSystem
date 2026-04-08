'use server'

import { prisma } from '@/lib/prisma'
import type { AopMetric, AopCascadeStatus } from '@prisma/client'

const MONTHS = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'] as const

type MonthlyTargets = Record<(typeof MONTHS)[number], number>

// ── Org AOP ──

export async function getOrgAops(fiscalYear: string) {
  return prisma.orgAop.findMany({
    where: { fiscal_year: fiscalYear },
    include: { department_aops: { include: { department: true } } },
    orderBy: { metric: 'asc' },
  })
}

export async function upsertOrgAop(data: {
  fiscal_year: string
  metric: AopMetric
  annual_target: number
  monthly: MonthlyTargets
  created_by: string
}) {
  // Validate: sum of months = annual_target (within 0.01 tolerance)
  const monthSum = MONTHS.reduce((sum, m) => sum + data.monthly[m], 0)
  if (Math.abs(monthSum - data.annual_target) > 0.01) {
    throw new Error(`Monthly targets sum (${monthSum}) does not match annual target (${data.annual_target})`)
  }

  return prisma.orgAop.upsert({
    where: { fiscal_year_metric: { fiscal_year: data.fiscal_year, metric: data.metric } },
    create: {
      fiscal_year: data.fiscal_year,
      metric: data.metric,
      annual_target: data.annual_target,
      ...data.monthly,
      created_by: data.created_by,
    },
    update: {
      annual_target: data.annual_target,
      ...data.monthly,
      updated_at: new Date(),
    },
  })
}

// ── Department AOP ──

export async function getDepartmentAops(orgAopId: string) {
  return prisma.departmentAop.findMany({
    where: { org_aop_id: orgAopId },
    include: { department: true, employee_aops: { include: { employee: true } } },
    orderBy: { department: { name: 'asc' } },
  })
}

export async function upsertDepartmentAop(data: {
  org_aop_id: string
  department_id: string
  annual_target: number
  monthly: MonthlyTargets
}) {
  const monthSum = MONTHS.reduce((sum, m) => sum + data.monthly[m], 0)
  if (Math.abs(monthSum - data.annual_target) > 0.01) {
    throw new Error(`Monthly targets sum (${monthSum}) does not match annual target (${data.annual_target})`)
  }

  return prisma.departmentAop.upsert({
    where: { org_aop_id_department_id: { org_aop_id: data.org_aop_id, department_id: data.department_id } },
    create: { ...data.monthly, org_aop_id: data.org_aop_id, department_id: data.department_id, annual_target: data.annual_target },
    update: { ...data.monthly, annual_target: data.annual_target, updated_at: new Date() },
  })
}

export async function validateDepartmentCascade(orgAopId: string): Promise<{ valid: boolean; orgTotal: number; deptTotal: number }> {
  const orgAop = await prisma.orgAop.findUniqueOrThrow({ where: { id: orgAopId } })
  const deptAops = await prisma.departmentAop.findMany({ where: { org_aop_id: orgAopId } })
  const deptTotal = deptAops.reduce((sum, d) => sum + Number(d.annual_target), 0)
  const orgTotal = Number(orgAop.annual_target)
  return { valid: Math.abs(deptTotal - orgTotal) < 0.01, orgTotal, deptTotal }
}

// ── Employee AOP ──

export async function getEmployeeAops(departmentAopId: string) {
  return prisma.employeeAop.findMany({
    where: { department_aop_id: departmentAopId },
    include: { employee: true, mis_actuals: true },
    orderBy: { employee: { full_name: 'asc' } },
  })
}

export async function upsertEmployeeAop(data: {
  department_aop_id: string
  employee_id: string
  annual_target: number
  monthly: MonthlyTargets
}) {
  const monthSum = MONTHS.reduce((sum, m) => sum + data.monthly[m], 0)
  if (Math.abs(monthSum - data.annual_target) > 0.01) {
    throw new Error(`Monthly targets sum (${monthSum}) does not match annual target (${data.annual_target})`)
  }

  return prisma.employeeAop.upsert({
    where: { department_aop_id_employee_id: { department_aop_id: data.department_aop_id, employee_id: data.employee_id } },
    create: { ...data.monthly, department_aop_id: data.department_aop_id, employee_id: data.employee_id, annual_target: data.annual_target },
    update: { ...data.monthly, annual_target: data.annual_target, updated_at: new Date() },
  })
}

export async function validateEmployeeCascade(departmentAopId: string): Promise<{
  valid: boolean
  deptTotal: number
  empTotal: number
  perMonth: Record<string, { dept: number; emp: number; valid: boolean }>
}> {
  const deptAop = await prisma.departmentAop.findUniqueOrThrow({ where: { id: departmentAopId } })
  const empAops = await prisma.employeeAop.findMany({ where: { department_aop_id: departmentAopId } })

  const empTotal = empAops.reduce((sum, e) => sum + Number(e.annual_target), 0)
  const deptTotal = Number(deptAop.annual_target)

  const perMonth: Record<string, { dept: number; emp: number; valid: boolean }> = {}
  for (const month of MONTHS) {
    const dept = Number((deptAop as Record<string, unknown>)[month])
    const emp = empAops.reduce((sum, e) => sum + Number((e as Record<string, unknown>)[month]), 0)
    perMonth[month] = { dept, emp, valid: Math.abs(dept - emp) < 0.01 }
  }

  return { valid: Math.abs(deptTotal - empTotal) < 0.01, deptTotal, empTotal, perMonth }
}

export async function lockDepartmentCascade(departmentAopId: string): Promise<void> {
  const validation = await validateEmployeeCascade(departmentAopId)
  if (!validation.valid) {
    throw new Error(`Cannot lock: employee targets (${validation.empTotal}) do not match department target (${validation.deptTotal})`)
  }
  // Check per-month validation too
  for (const [month, check] of Object.entries(validation.perMonth)) {
    if (!check.valid) {
      throw new Error(`Cannot lock: ${month} employee total (${check.emp}) does not match department target (${check.dept})`)
    }
  }
  await prisma.departmentAop.update({ where: { id: departmentAopId }, data: { status: 'locked' } })
}

// ── MIS Actuals ──

export async function getEmployeeMisActuals(employeeAopId: string) {
  return prisma.employeeMisActual.findMany({
    where: { employee_aop_id: employeeAopId },
    orderBy: { month: 'asc' },
  })
}

export async function bulkUpsertMisActuals(actuals: { employee_aop_id: string; month: string; actual_value: number; uploaded_by: string }[]) {
  const results = await prisma.$transaction(
    actuals.map((a) =>
      prisma.employeeMisActual.upsert({
        where: { employee_aop_id_month: { employee_aop_id: a.employee_aop_id, month: a.month } },
        create: a,
        update: { actual_value: a.actual_value },
      })
    )
  )
  return results
}

// ── Cascade Tree ──

export async function getCascadeTree(fiscalYear: string, metric: AopMetric) {
  const orgAop = await prisma.orgAop.findUnique({
    where: { fiscal_year_metric: { fiscal_year: fiscalYear, metric } },
    include: {
      department_aops: {
        include: {
          department: true,
          employee_aops: {
            include: { employee: true, mis_actuals: true },
          },
        },
        orderBy: { department: { name: 'asc' } },
      },
    },
  })
  return orgAop
}

// ── Founder View ──

export async function getFounderDepartmentSummary(fiscalYear: string) {
  const orgAops = await prisma.orgAop.findMany({
    where: { fiscal_year: fiscalYear },
    include: {
      department_aops: {
        include: {
          department: true,
          employee_aops: {
            include: {
              employee: {
                select: {
                  id: true,
                  full_name: true,
                  fixed_ctc: true,
                  annual_variable: true,
                  retention_bonus: true,
                  onetime_bonus: true,
                },
              },
              mis_actuals: true,
            },
          },
        },
      },
    },
  })
  return orgAops
}

// ── Exported constants ──

export { MONTHS }
export type { MonthlyTargets, AopMetric, AopCascadeStatus }
