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

export interface FounderEmployeeRow {
  id: string
  name: string
  currency: string
  ctc: number
  ctcInr: number
  targets: Record<string, number>
  actuals: Record<string, number>
}

export interface FounderDeptRow {
  department: { id: string; name: string }
  teamSize: number
  totalCtcInr: number
  metrics: {
    delivered_revenue: { target: number; actual: number; pct: number }
    gross_margin: { target: number; actual: number; pct: number }
    gmv: { target: number; actual: number; pct: number }
  }
  employees: FounderEmployeeRow[]
}

export interface FounderViewResult {
  orgTotals: {
    delivered_revenue: { target: number; actual: number; pct: number }
    gross_margin: { target: number; actual: number; pct: number }
    gmv: { target: number; actual: number; pct: number }
  }
  departments: FounderDeptRow[]
  exchangeRates: Record<string, number>  // from_currency -> rate to INR
}

export async function getFounderViewData(fiscalYear: string): Promise<FounderViewResult> {
  const METRIC_KEYS = ['delivered_revenue', 'gross_margin', 'gmv'] as const

  // Fetch all OrgAops with nested DepartmentAops → EmployeeAops → MisActuals + employee CTC
  const [orgAops, exchangeRatesRaw] = await Promise.all([
    prisma.orgAop.findMany({
      where: { fiscal_year: fiscalYear },
      include: {
        department_aops: {
          include: {
            department: { select: { id: true, name: true } },
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
                    salary_currency: true,
                  },
                },
                mis_actuals: true,
              },
            },
          },
        },
      },
    }),
    prisma.exchangeRate.findMany({
      where: { fiscal_year: fiscalYear, to_currency: 'INR' },
    }),
  ])

  // Build exchange rate map: currency -> INR rate
  const exchangeRates: Record<string, number> = { INR: 1 }
  for (const er of exchangeRatesRaw) {
    exchangeRates[er.from_currency] = Number(er.rate)
  }

  function toInr(amount: number, currency: string): number {
    const rate = exchangeRates[currency] ?? 1
    return amount * rate
  }

  function computeCtc(emp: {
    fixed_ctc: { toNumber(): number } | null
    annual_variable: { toNumber(): number } | null
    retention_bonus: { toNumber(): number } | null
    onetime_bonus: { toNumber(): number } | null
  }): number {
    return (
      (emp.fixed_ctc ? Number(emp.fixed_ctc) : 0) +
      (emp.annual_variable ? Number(emp.annual_variable) : 0) +
      (emp.retention_bonus ? Number(emp.retention_bonus) : 0) +
      (emp.onetime_bonus ? Number(emp.onetime_bonus) : 0)
    )
  }

  // Collect department summaries keyed by department id
  type DeptAccumulator = {
    department: { id: string; name: string }
    metricTargets: Record<string, number>
    metricActuals: Record<string, number>
    employeeMap: Map<string, {
      id: string
      name: string
      currency: string
      ctc: number
      ctcInr: number
      targets: Record<string, number>
      actuals: Record<string, number>
    }>
  }

  const deptMap = new Map<string, DeptAccumulator>()

  for (const orgAop of orgAops) {
    const metric = orgAop.metric as string

    for (const deptAop of orgAop.department_aops) {
      const deptId = deptAop.department.id

      if (!deptMap.has(deptId)) {
        deptMap.set(deptId, {
          department: { id: deptAop.department.id, name: deptAop.department.name },
          metricTargets: {},
          metricActuals: {},
          employeeMap: new Map(),
        })
      }
      const deptAcc = deptMap.get(deptId)!

      // Accumulate dept-level targets
      deptAcc.metricTargets[metric] = Number(deptAop.annual_target)

      // Accumulate employee data
      for (const empAop of deptAop.employee_aops) {
        const empId = empAop.employee.id

        if (!deptAcc.employeeMap.has(empId)) {
          const currency = empAop.employee.salary_currency ?? 'INR'
          const ctc = computeCtc(empAop.employee)
          deptAcc.employeeMap.set(empId, {
            id: empId,
            name: empAop.employee.full_name,
            currency,
            ctc,
            ctcInr: toInr(ctc, currency),
            targets: {},
            actuals: {},
          })
        }

        const empRow = deptAcc.employeeMap.get(empId)!

        // Employee target for this metric
        empRow.targets[metric] = Number(empAop.annual_target)

        // Employee actuals: sum of mis_actuals
        const ytdActual = empAop.mis_actuals.reduce((sum, ma) => sum + Number(ma.actual_value), 0)
        empRow.actuals[metric] = ytdActual

        // Accumulate dept actuals
        deptAcc.metricActuals[metric] = (deptAcc.metricActuals[metric] ?? 0) + ytdActual
      }
    }
  }

  // Org-level accumulators
  const orgTargets: Record<string, number> = {}
  const orgActuals: Record<string, number> = {}

  // Build result departments
  const departments: FounderDeptRow[] = []

  for (const [, deptAcc] of deptMap) {
    const employees = Array.from(deptAcc.employeeMap.values())

    // Unique employee count
    const teamSize = employees.length

    // Total CTC in INR
    const totalCtcInr = employees.reduce((sum, e) => sum + e.ctcInr, 0)

    function metricSummary(key: string) {
      const target = deptAcc.metricTargets[key] ?? 0
      const actual = deptAcc.metricActuals[key] ?? 0
      const pct = target > 0 ? Math.round((actual / target) * 100) : 0
      orgTargets[key] = (orgTargets[key] ?? 0) + target
      orgActuals[key] = (orgActuals[key] ?? 0) + actual
      return { target, actual, pct }
    }

    departments.push({
      department: deptAcc.department,
      teamSize,
      totalCtcInr,
      metrics: {
        delivered_revenue: metricSummary('delivered_revenue'),
        gross_margin: metricSummary('gross_margin'),
        gmv: metricSummary('gmv'),
      },
      employees,
    })
  }

  // Sort departments by name
  departments.sort((a, b) => a.department.name.localeCompare(b.department.name))

  function orgMetricSummary(key: string) {
    const target = orgTargets[key] ?? 0
    const actual = orgActuals[key] ?? 0
    return { target, actual, pct: target > 0 ? Math.round((actual / target) * 100) : 0 }
  }

  return {
    orgTotals: {
      delivered_revenue: orgMetricSummary('delivered_revenue'),
      gross_margin: orgMetricSummary('gross_margin'),
      gmv: orgMetricSummary('gmv'),
    },
    departments,
    exchangeRates,
  }
}

// ── Employee Exit ──

/**
 * Mark an employee as exited from AOP targets.
 * Zeros out remaining months (months after exitedAt).
 * Returns the updated EmployeeAop.
 */
export async function markEmployeeExited(employeeAopId: string, exitedAt: Date) {
  const empAop = await prisma.employeeAop.findUniqueOrThrow({ where: { id: employeeAopId } })

  // Determine exit month index (MONTHS is Apr-indexed fiscal year)
  const exitMonth = exitedAt.toLocaleString('en-US', { month: 'short' }).toLowerCase() as (typeof MONTHS)[number]
  const exitIdx = MONTHS.indexOf(exitMonth)

  // Zero out months after the exit month
  const updates: Record<string, number> = {}
  for (let i = exitIdx + 1; i < MONTHS.length; i++) {
    updates[MONTHS[i]] = 0
  }

  // Recalculate annual_target as sum of kept months
  const updatedMonths = {
    ...Object.fromEntries(MONTHS.map((m) => [m, Number((empAop as unknown as Record<string, unknown>)[m])])),
    ...updates,
  }
  const newAnnual = MONTHS.reduce((sum, m) => sum + (updatedMonths[m] || 0), 0)

  return prisma.employeeAop.update({
    where: { id: employeeAopId },
    data: { ...updates, annual_target: newAnnual, exited_at: exitedAt, updated_at: new Date() },
  })
}

/**
 * Create a replacement EmployeeAop for an exited employee.
 * The replacement gets its own monthly targets (caller supplies them).
 */
export async function createReplacementAop(data: {
  original_employee_aop_id: string
  replacement_employee_id: string
  monthly: MonthlyTargets
}) {
  const original = await prisma.employeeAop.findUniqueOrThrow({
    where: { id: data.original_employee_aop_id },
  })
  const annual = MONTHS.reduce((sum, m) => sum + data.monthly[m], 0)

  return prisma.employeeAop.create({
    data: {
      department_aop_id: original.department_aop_id,
      employee_id: data.replacement_employee_id,
      annual_target: annual,
      ...data.monthly,
      replacement_for: data.original_employee_aop_id,
    },
  })
}

// ── Exported constants ──

export { MONTHS }
export type { MonthlyTargets, AopMetric, AopCascadeStatus }
