'use server'

import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

const MONTHS = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'] as const

type MonthKey = (typeof MONTHS)[number]

function parseMonthly(formData: FormData, prefix = ''): Record<MonthKey, number> | { error: string } {
  const result = {} as Record<MonthKey, number>
  for (const m of MONTHS) {
    const val = Number(formData.get(prefix + m))
    if (isNaN(val) || val < 0) return { error: `Invalid value for ${m}` }
    result[m] = val
  }
  return result
}

function monthlyFields(monthly: Record<MonthKey, number>) {
  return {
    apr: monthly.apr,
    may: monthly.may,
    jun: monthly.jun,
    jul: monthly.jul,
    aug: monthly.aug,
    sep: monthly.sep,
    oct: monthly.oct,
    nov: monthly.nov,
    dec: monthly.dec,
    jan: monthly.jan,
    feb: monthly.feb,
    mar: monthly.mar,
  }
}

function monthSum(monthly: Record<MonthKey, number>): number {
  return MONTHS.reduce((sum, m) => sum + monthly[m], 0)
}

export async function saveOrgAop(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['admin'])

  const fiscal_year = (formData.get('fiscal_year') as string)?.trim()
  const metric = (formData.get('metric') as string)?.trim()
  const annual_target = Number(formData.get('annual_target'))

  if (!fiscal_year) return { data: null, error: 'Fiscal year is required' }
  if (!metric || !['delivered_revenue', 'gross_margin', 'gmv'].includes(metric)) {
    return { data: null, error: 'Valid metric is required' }
  }
  if (isNaN(annual_target) || annual_target <= 0) {
    return { data: null, error: 'Annual target must be a positive number' }
  }

  const monthly = parseMonthly(formData)
  if ('error' in monthly) return { data: null, error: monthly.error }

  const sum = monthSum(monthly)
  if (Math.abs(sum - annual_target) > 0.01) {
    return { data: null, error: `Monthly sum (${sum.toFixed(2)}) does not match annual target (${annual_target.toFixed(2)})` }
  }

  try {
    const orgAop = await prisma.orgAop.upsert({
      where: {
        fiscal_year_metric: { fiscal_year, metric: metric as 'delivered_revenue' | 'gross_margin' | 'gmv' },
      },
      create: {
        fiscal_year,
        metric: metric as 'delivered_revenue' | 'gross_margin' | 'gmv',
        annual_target,
        ...monthlyFields(monthly),
        created_by: user.id,
      },
      update: {
        annual_target,
        ...monthlyFields(monthly),
        updated_at: new Date(),
      },
    })

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'aop_org_target_set',
        entity_type: 'org_aop',
        entity_id: orgAop.id,
        new_value: { fiscal_year, metric, annual_target, ...monthlyFields(monthly) },
      },
    })
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to save org target' }
  }

  revalidatePath('/admin/aop')
  return { data: null, error: null }
}

export async function saveDepartmentSplit(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['admin'])

  const org_aop_id = (formData.get('org_aop_id') as string)?.trim()
  if (!org_aop_id) return { data: null, error: 'Org AOP ID is required' }

  const orgAop = await prisma.orgAop.findUnique({ where: { id: org_aop_id } })
  if (!orgAop) return { data: null, error: 'Org AOP record not found' }

  const deptIdsStr = (formData.get('department_ids') as string)?.trim()
  if (!deptIdsStr) return { data: null, error: 'No departments provided' }
  const departmentIds = deptIdsStr.split(',')

  const deptData: Array<{
    department_id: string
    annual_target: number
    monthly: Record<MonthKey, number>
  }> = []

  for (const deptId of departmentIds) {
    const annual = Number(formData.get(`dept_${deptId}_annual`))
    if (isNaN(annual) || annual < 0) {
      return { data: null, error: `Invalid annual target for department ${deptId}` }
    }

    const monthly = parseMonthly(formData, `dept_${deptId}_`)
    if ('error' in monthly) return { data: null, error: monthly.error }

    const sum = monthSum(monthly)
    if (Math.abs(sum - annual) > 0.01) {
      return { data: null, error: `Department monthly sum (${sum.toFixed(2)}) does not match its annual target (${annual.toFixed(2)})` }
    }

    deptData.push({ department_id: deptId, annual_target: annual, monthly })
  }

  // Validate total: sum of all dept annuals = org annual target
  const totalAnnual = deptData.reduce((sum, d) => sum + d.annual_target, 0)
  const orgAnnual = Number(orgAop.annual_target)
  if (Math.abs(totalAnnual - orgAnnual) > 0.01) {
    return { data: null, error: `Department annual total (${totalAnnual.toFixed(2)}) does not match org target (${orgAnnual.toFixed(2)})` }
  }

  // Validate per month: sum of all dept monthly = org monthly
  for (const m of MONTHS) {
    const deptMonthTotal = deptData.reduce((sum, d) => sum + d.monthly[m], 0)
    const orgMonth = Number((orgAop as unknown as Record<string, unknown>)[m])
    if (Math.abs(deptMonthTotal - orgMonth) > 0.01) {
      return { data: null, error: `${m.toUpperCase()} total (${deptMonthTotal.toFixed(2)}) does not match org target (${orgMonth.toFixed(2)})` }
    }
  }

  try {
    await prisma.$transaction(
      deptData.map((d) =>
        prisma.departmentAop.upsert({
          where: {
            org_aop_id_department_id: { org_aop_id, department_id: d.department_id },
          },
          create: {
            org_aop_id,
            department_id: d.department_id,
            annual_target: d.annual_target,
            ...monthlyFields(d.monthly),
          },
          update: {
            annual_target: d.annual_target,
            ...monthlyFields(d.monthly),
            updated_at: new Date(),
          },
        })
      )
    )

    // Send notification to department heads
    const deptHeads = await prisma.user.findMany({
      where: {
        department_id: { in: departmentIds },
        role: 'department_head',
        is_active: true,
      },
      select: { id: true },
    })

    if (deptHeads.length > 0) {
      await prisma.notification.createMany({
        data: deptHeads.map((head) => ({
          recipient_id: head.id,
          type: 'admin_message' as const,
          payload: {
            title: 'AOP Targets Updated',
            body: `Your department AOP targets for ${orgAop.fiscal_year} (${orgAop.metric.replace(/_/g, ' ')}) have been set by admin.`,
          },
        })),
      })
    }

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'aop_department_split',
        entity_type: 'org_aop',
        entity_id: org_aop_id,
        new_value: {
          departments: deptData.map((d) => ({
            department_id: d.department_id,
            annual_target: d.annual_target,
          })),
        },
      },
    })
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to save department split' }
  }

  revalidatePath('/admin/aop')
  return { data: null, error: null }
}
