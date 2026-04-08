'use server'

import { prisma } from '@/lib/prisma'

const MONTHS = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'] as const

const AOP_KPI_TITLES: Record<string, string> = {
  delivered_revenue: 'Delivered Revenue',
  gross_margin: 'Gross Margin',
  gmv: 'New Sales (GMV)',
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
 * Auto-assign KPIs for each employee in a locked AOP cascade.
 *
 * Uses protected KPI templates ("Delivered Revenue", "Gross Margin", "New Sales (GMV)")
 * when they exist; falls back to creating KPIs directly otherwise.
 *
 * Skips employees with exited_at set.
 * Idempotent: if a KPI already exists for the same employee_aop_id + cycle, it updates
 * the target only if it has changed.
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

  const metric = deptAop.org_aop.metric
  const kpiTitle = AOP_KPI_TITLES[metric] ?? metric

  // 2. Get cycle to determine which months it covers
  const cycle = await prisma.cycle.findUniqueOrThrow({ where: { id: cycleId } })
  const cycleMonths = getCycleMonths(cycle.cycle_type, cycle.period)
  if (cycleMonths.length === 0) return

  // 3. Look up the protected KPI template for this metric (for kra_template_id linkage)
  const kpiTemplate = await prisma.kpiTemplate.findFirst({
    where: { title: kpiTitle, is_protected: true },
    include: { kra_template: true },
  })
  const kraTitle = 'AOP Targets'

  // 4. For each employee AOP
  for (const empAop of deptAop.employee_aops) {
    // Skip exited employees
    if (empAop.exited_at) continue

    // a. Sum monthly targets for the cycle's months
    const targetValue = cycleMonths.reduce((sum, month) => {
      const val = (empAop as Record<string, unknown>)[month]
      return sum + Number(val || 0)
    }, 0)

    // b. Idempotent check — skip or update if already exists
    const existing = await prisma.kpi.findFirst({
      where: {
        cycle_id: cycleId,
        employee_id: empAop.employee_id,
        is_aop_linked: true,
        employee_aop_id: empAop.id,
      },
    })
    if (existing) {
      // Update target if it changed
      if (Number(existing.target) !== targetValue) {
        await prisma.kpi.update({ where: { id: existing.id }, data: { target: targetValue } })
      }
      continue
    }

    // c. Find or create KRA "AOP Targets" for this employee in this cycle
    let kra = await prisma.kra.findFirst({
      where: { cycle_id: cycleId, employee_id: empAop.employee_id, title: kraTitle },
    })
    if (!kra) {
      kra = await prisma.kra.create({
        data: {
          cycle_id: cycleId,
          employee_id: empAop.employee_id,
          title: kraTitle,
          category: 'performance',
          weight: null,
          kra_template_id: kpiTemplate?.kra_template?.id ?? null,
        },
      })
    }

    // d. Get the employee's manager_id (required by Kpi model)
    const managerId = empAop.employee.manager_id
    if (!managerId) {
      console.warn(
        `[aop-kpi-sync] Skipping employee ${empAop.employee_id}: no manager_id assigned`
      )
      continue
    }

    // e. Create KPI linked to the protected template (if available)
    await prisma.kpi.create({
      data: {
        cycle_id: cycleId,
        employee_id: empAop.employee_id,
        manager_id: managerId,
        kra_id: kra.id,
        title: kpiTitle,
        description: `AOP target for ${deptAop.org_aop.fiscal_year}`,
        unit: 'number',
        target: targetValue,
        weight: null,
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
