import { prisma } from '@/lib/prisma'
import type { RatingTier } from '@prisma/client'

const TIERS: RatingTier[] = ['FEE', 'EE', 'ME', 'SME', 'BE']

const TIER_LABELS: Record<string, string> = {
  FEE: 'Outstanding',
  EE: 'Exceeds Expectations',
  ME: 'Meets Expectations',
  SME: 'Below Expectations',
  BE: 'Unsatisfactory',
}

/* ── Types ── */

export interface CycleReportData {
  cycleId: string
  cycleName: string
  quarter: string
  year: number
  status: string
  scopedEmployeeCount: number
  selfReviewCount: number
  managerReviewCount: number
  selfReviewRate: number
  managerReviewRate: number
  ratingDist: Record<RatingTier, number>
  totalRated: number
  totalPayout: number
  avgMultiplier: number
  exitedCount: number
}

export interface DeptBreakdown {
  departmentId: string
  departmentName: string
  employeeCount: number
  ratingDist: Record<RatingTier, number>
  totalPayout: number
}

export interface EmployeeReportRow {
  employeeName: string
  department: string
  selfRating: string | null
  managerRating: string | null
  finalRating: string | null
  variablePay: number
  multiplier: number
  payoutAmount: number
  isExitFrozen: boolean
  prorationFactor: number | null
}

/* ── Data Fetchers ── */

/**
 * Fetch comprehensive report data for given cycles.
 * Optionally filter by department IDs or employee IDs.
 */
export async function fetchCycleReports(opts?: {
  cycleIds?: string[]
  departmentIds?: string[]
  employeeIds?: string[]
  limit?: number
}): Promise<CycleReportData[]> {
  const cycles = await prisma.cycle.findMany({
    where: opts?.cycleIds?.length ? { id: { in: opts.cycleIds } } : undefined,
    orderBy: { created_at: 'desc' },
    take: opts?.limit ?? 10,
    include: { departments: { select: { department_id: true } } },
  })

  const results: CycleReportData[] = []

  for (const cycle of cycles) {
    const cycleDeptIds = cycle.departments.map(d => d.department_id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appraisalWhere: any = { cycle_id: cycle.id }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviewWhere: any = { cycle_id: cycle.id, status: 'submitted' as const }

    // Scope by employee IDs (manager view)
    if (opts?.employeeIds?.length) {
      appraisalWhere.employee_id = { in: opts.employeeIds }
      reviewWhere.employee_id = { in: opts.employeeIds }
    }
    // Scope by department IDs (hrbp view)
    else if (opts?.departmentIds?.length) {
      appraisalWhere.employee = { department_id: { in: opts.departmentIds } }
      reviewWhere.employee = { department_id: { in: opts.departmentIds } }
    }

    const [selfReviews, appraisals, scopedCount] = await Promise.all([
      prisma.review.count({ where: reviewWhere }),
      prisma.appraisal.findMany({
        where: appraisalWhere,
        select: {
          manager_rating: true,
          final_rating: true,
          manager_submitted_at: true,
          payout_multiplier: true,
          payout_amount: true,
          is_exit_frozen: true,
        },
      }),
      opts?.employeeIds?.length
        ? Promise.resolve(opts.employeeIds.length)
        : prisma.user.count({
            where: {
              is_active: true,
              role: { notIn: ['admin', 'hrbp'] },
              ...(opts?.departmentIds?.length
                ? { department_id: { in: opts.departmentIds } }
                : cycleDeptIds.length > 0
                  ? { department_id: { in: cycleDeptIds } }
                  : {}),
            },
          }),
    ])

    const ratingDist: Record<RatingTier, number> = { FEE: 0, EE: 0, ME: 0, SME: 0, BE: 0 }
    let managerReviewCount = 0
    let totalPayout = 0
    let totalMultiplier = 0
    let multiplierCount = 0
    let exitedCount = 0

    for (const a of appraisals) {
      const rating = (a.final_rating ?? a.manager_rating) as RatingTier | null
      if (rating && TIERS.includes(rating)) ratingDist[rating]++
      if (a.manager_submitted_at) managerReviewCount++
      totalPayout += Number(a.payout_amount ?? 0)
      if (a.payout_multiplier != null) {
        totalMultiplier += Number(a.payout_multiplier)
        multiplierCount++
      }
      if (a.is_exit_frozen) exitedCount++
    }

    const totalRated = TIERS.reduce((s, t) => s + ratingDist[t], 0)

    results.push({
      cycleId: cycle.id,
      cycleName: cycle.name,
      quarter: cycle.quarter,
      year: cycle.year,
      status: cycle.status,
      scopedEmployeeCount: scopedCount,
      selfReviewCount: selfReviews,
      managerReviewCount,
      selfReviewRate: scopedCount > 0 ? Math.round((selfReviews / scopedCount) * 100) : 0,
      managerReviewRate: scopedCount > 0 ? Math.round((managerReviewCount / scopedCount) * 100) : 0,
      ratingDist,
      totalRated,
      totalPayout,
      avgMultiplier: multiplierCount > 0 ? totalMultiplier / multiplierCount : 0,
      exitedCount,
    })
  }

  return results
}

/**
 * Get rating distribution broken down by department for a specific cycle.
 */
export async function fetchDeptBreakdown(
  cycleId: string,
  departmentIds?: string[]
): Promise<DeptBreakdown[]> {
  const departments = await prisma.department.findMany({
    where: departmentIds?.length ? { id: { in: departmentIds } } : undefined,
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  const results: DeptBreakdown[] = []

  for (const dept of departments) {
    const appraisals = await prisma.appraisal.findMany({
      where: {
        cycle_id: cycleId,
        employee: { department_id: dept.id },
      },
      select: {
        final_rating: true,
        manager_rating: true,
        payout_amount: true,
      },
    })

    if (appraisals.length === 0) continue

    const ratingDist: Record<RatingTier, number> = { FEE: 0, EE: 0, ME: 0, SME: 0, BE: 0 }
    let totalPayout = 0
    for (const a of appraisals) {
      const rating = (a.final_rating ?? a.manager_rating) as RatingTier | null
      if (rating && TIERS.includes(rating)) ratingDist[rating]++
      totalPayout += Number(a.payout_amount ?? 0)
    }

    results.push({
      departmentId: dept.id,
      departmentName: dept.name,
      employeeCount: appraisals.length,
      ratingDist,
      totalPayout,
    })
  }

  return results
}

/**
 * Get employee-level detail rows for a cycle.
 */
export async function fetchEmployeeRows(
  cycleId: string,
  opts?: { departmentIds?: string[]; employeeIds?: string[] }
): Promise<EmployeeReportRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { cycle_id: cycleId }
  if (opts?.employeeIds?.length) {
    where.employee_id = { in: opts.employeeIds }
  } else if (opts?.departmentIds?.length) {
    where.employee = { department_id: { in: opts.departmentIds } }
  }

  const appraisals = await prisma.appraisal.findMany({
    where,
    include: {
      employee: {
        select: {
          id: true,
          full_name: true,
          department: { select: { name: true } },
        },
      },
    },
    orderBy: { employee: { full_name: 'asc' } },
  })

  // Fetch self-review ratings separately (Review is not related to Appraisal directly)
  const employeeIds = appraisals.map(a => a.employee_id)
  const reviews = await prisma.review.findMany({
    where: { cycle_id: cycleId, employee_id: { in: employeeIds } },
    select: { employee_id: true, self_rating: true },
  })
  const reviewMap = new Map(reviews.map(r => [r.employee_id, r.self_rating]))

  return appraisals.map(a => ({
    employeeName: a.employee?.full_name ?? 'Unknown',
    department: a.employee?.department?.name ?? '-',
    selfRating: reviewMap.get(a.employee_id) ?? null,
    managerRating: a.manager_rating,
    finalRating: a.final_rating,
    variablePay: Number(a.snapshotted_variable_pay ?? 0),
    multiplier: Number(a.payout_multiplier ?? 0),
    payoutAmount: Number(a.payout_amount ?? 0),
    isExitFrozen: a.is_exit_frozen,
    prorationFactor: a.proration_factor != null ? Number(a.proration_factor) : null,
  }))
}

export { TIER_LABELS, TIERS }
