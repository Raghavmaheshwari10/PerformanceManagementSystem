'use server'

import { prisma } from '@/lib/prisma'

const MONTHS = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'] as const

const METRIC_NAMES: Record<string, string> = {
  delivered_revenue: 'Delivered Revenue',
  gross_margin: 'Gross Margin',
  gmv: 'GMV (New Orders)',
}

/**
 * Determine which months a cycle covers based on its type and period.
 */
function getCycleMonths(cycleType: string, period: string | null): string[] {
  switch (cycleType) {
    case 'monthly':
      return period ? [period.toLowerCase()] : []
    case 'quarterly':
      switch (period?.toUpperCase()) {
        case 'Q1': return ['apr', 'may', 'jun']
        case 'Q2': return ['jul', 'aug', 'sep']
        case 'Q3': return ['oct', 'nov', 'dec']
        case 'Q4': return ['jan', 'feb', 'mar']
        default: return []
      }
    case 'halfyearly':
      switch (period?.toUpperCase()) {
        case 'H1': return ['apr', 'may', 'jun', 'jul', 'aug', 'sep']
        case 'H2': return ['oct', 'nov', 'dec', 'jan', 'feb', 'mar']
        default: return []
      }
    case 'annual':
      return [...MONTHS]
    default:
      return []
  }
}

/**
 * Auto-create KPIs for each employee in a locked AOP cascade.
 *
 * For each EmployeeAop under the given DepartmentAop, this creates:
 * - A KRA "AOP Targets" (if one doesn't already exist for that employee+cycle)
 * - A KPI with the metric name, target summed from the relevant months
 *
 * Idempotent: skips employees who already have a KPI linked to the same employee_aop_id + cycle.
 */
export async function createKpisFromCascade(departmentAopId: string, cycleId: string) {
  // 1. Get DepartmentAop with parent OrgAop (for metric) and all EmployeeAops
  const deptAop = await prisma.departmentAop.findUniqueOrThrow({
    where: { id: departmentAopId },
    include: {
      org_aop: true,
      employee_aops: { include: { employee: true } },
    },
  })

  const metric = deptAop.org_aop.metric // e.g., 'delivered_revenue'
  const metricName = METRIC_NAMES[metric] || metric

  // 2. Get cycle to determine which months it covers
  const cycle = await prisma.cycle.findUniqueOrThrow({ where: { id: cycleId } })
  const cycleMonths = getCycleMonths(cycle.cycle_type, cycle.period)
  if (cycleMonths.length === 0) return

  // 3. For each employee AOP
  for (const empAop of deptAop.employee_aops) {
    // a. Sum monthly targets for the cycle's months
    const targetValue = cycleMonths.reduce((sum, month) => {
      const val = (empAop as Record<string, unknown>)[month]
      return sum + Number(val || 0)
    }, 0)

    // b. Skip if KPI already exists for this employee+cycle+employee_aop (idempotent)
    const existing = await prisma.kpi.findFirst({
      where: {
        cycle_id: cycleId,
        employee_id: empAop.employee_id,
        is_aop_linked: true,
        employee_aop_id: empAop.id,
      },
    })
    if (existing) continue

    // c. Find or create a KRA "AOP Targets" for this employee in this cycle
    let kra = await prisma.kra.findFirst({
      where: {
        cycle_id: cycleId,
        employee_id: empAop.employee_id,
        title: 'AOP Targets',
      },
    })
    if (!kra) {
      kra = await prisma.kra.create({
        data: {
          cycle_id: cycleId,
          employee_id: empAop.employee_id,
          title: 'AOP Targets',
          category: 'performance',
          weight: 100, // will be adjusted if other KRAs exist
        },
      })
    }

    // d. Get the employee's manager_id (required by Kpi model)
    const managerId = empAop.employee.manager_id
    if (!managerId) {
      // Cannot create KPI without a manager — skip this employee
      console.warn(
        `[aop-kpi-sync] Skipping employee ${empAop.employee_id}: no manager_id assigned`
      )
      continue
    }

    // e. Create KPI
    await prisma.kpi.create({
      data: {
        cycle_id: cycleId,
        employee_id: empAop.employee_id,
        manager_id: managerId,
        kra_id: kra.id,
        title: metricName,
        description: `Auto-created from AOP cascade (${deptAop.org_aop.fiscal_year})`,
        unit: 'number',
        target: targetValue,
        weight: 0, // will be set by manager or auto-distributed
        is_aop_linked: true,
        employee_aop_id: empAop.id,
      },
    })
  }
}

/**
 * Update KPI actual values from MIS actuals data.
 *
 * For each KPI linked to the given EmployeeAop, sums up the EmployeeMisActual
 * values for the months covered by the KPI's cycle and writes to `achievement`.
 */
export async function updateKpiActualsFromMis(employeeAopId: string) {
  // Find all KPIs linked to this employee AOP
  const kpis = await prisma.kpi.findMany({
    where: { employee_aop_id: employeeAopId, is_aop_linked: true },
    include: { cycle: true },
  })

  // Get all MIS actuals for this employee AOP
  const actuals = await prisma.employeeMisActual.findMany({
    where: { employee_aop_id: employeeAopId },
  })

  // For each KPI, sum actuals for that cycle's months and update achievement
  for (const kpi of kpis) {
    const cycleMonths = getCycleMonths(kpi.cycle.cycle_type, kpi.cycle.period)
    const actualValue = actuals
      .filter(a => cycleMonths.includes(a.month))
      .reduce((sum, a) => sum + Number(a.actual_value), 0)

    await prisma.kpi.update({
      where: { id: kpi.id },
      data: { achievement: actualValue },
    })
  }
}
