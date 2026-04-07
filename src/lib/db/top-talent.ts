import { prisma } from '@/lib/prisma'
import type { RatingTier, TopTalentConfig } from '@prisma/client'

/* ── Rating helpers ── */

const RATING_NUMERIC: Record<string, number> = {
  FEE: 5,
  EE: 4,
  ME: 3,
  SME: 2,
  BE: 1,
}

const TIER_SORT_ORDER: Record<string, number> = {
  FEE: 0,
  EE: 1,
  ME: 2,
  SME: 3,
  BE: 4,
}

function ratingToNumeric(tier: string | null): number | null {
  if (!tier) return null
  return RATING_NUMERIC[tier] ?? null
}

/* ── Types ── */

export interface TopTalentEmployee {
  id: string
  fullName: string
  email: string
  department: string
  designation: string | null
  managerId: string | null
  managerName: string | null
  currentCycle: {
    cycleId: string
    cycleName: string
    finalRating: string
    compositeScore: number | null
    misScore: number | null
    payoutAmount: number
    multiplier: number
  }
  selfRating: string | null
  goalCompletion: number
  competencyAvg: number | null
  peerReviewAvg: number | null
  feedbackCount: number
  trend: 'up' | 'down' | 'same' | null
  consecutiveHighCycles: number
  cycleHistory: Array<{ cycleName: string; finalRating: string | null; compositeScore: number | null }>
}

export interface TopTalentStats {
  total: number
  percentOfOrg: number
  avgScore: number
  topDepartment: string | null
  byDepartment: Array<{ department: string; count: number; percentage: number }>
  byTier: Record<string, number>
  poolOverTime: Array<{ cycleName: string; count: number }>
}

/* ── Config ── */

export async function fetchTopTalentConfig(): Promise<TopTalentConfig> {
  const existing = await prisma.topTalentConfig.findFirst()
  if (existing) return existing

  return prisma.topTalentConfig.create({
    data: {
      rating_tiers: ['FEE', 'EE'],
      min_cycles: 1,
      score_threshold: 0,
      mis_threshold: 0,
    },
  })
}

export async function saveTopTalentConfig(data: {
  ratingTiers: string[]
  minCycles: number
  scoreThreshold: number
  misThreshold: number
  updatedBy: string
}): Promise<TopTalentConfig> {
  const existing = await prisma.topTalentConfig.findFirst()

  if (existing) {
    return prisma.topTalentConfig.update({
      where: { id: existing.id },
      data: {
        rating_tiers: data.ratingTiers,
        min_cycles: data.minCycles,
        score_threshold: data.scoreThreshold,
        mis_threshold: data.misThreshold,
        updated_by: data.updatedBy,
      },
    })
  }

  return prisma.topTalentConfig.create({
    data: {
      rating_tiers: data.ratingTiers,
      min_cycles: data.minCycles,
      score_threshold: data.scoreThreshold,
      mis_threshold: data.misThreshold,
      updated_by: data.updatedBy,
    },
  })
}

/* ── Pool query ── */

export async function fetchTopTalentPool(options?: {
  cycleId?: string
  managerId?: string
}): Promise<TopTalentEmployee[]> {
  const config = await fetchTopTalentConfig()

  // Resolve target cycle
  const targetCycle = options?.cycleId
    ? await prisma.cycle.findUnique({ where: { id: options.cycleId } })
    : await prisma.cycle.findFirst({
        where: { status: 'published' },
        orderBy: { published_at: 'desc' },
      })

  if (!targetCycle) return []

  // Fetch last 5 published cycles (including target) for history/trend
  const publishedCycles = await prisma.cycle.findMany({
    where: { status: 'published' },
    orderBy: { published_at: 'desc' },
    take: 5,
    select: { id: true, name: true, published_at: true },
  })

  const tiers = config.rating_tiers as RatingTier[]

  // Build appraisal filter
  const appraisalWhere: any = {
    cycle_id: targetCycle.id,
    is_exit_frozen: false,
    final_rating: { in: tiers },
  }
  if (options?.managerId) {
    appraisalWhere.employee = { manager_id: options.managerId }
  }

  // Fetch qualifying appraisals
  const appraisals = await prisma.appraisal.findMany({
    where: appraisalWhere,
    include: {
      employee: {
        select: {
          id: true,
          full_name: true,
          email: true,
          designation: true,
          department: { select: { name: true } },
          manager_id: true,
          manager: { select: { full_name: true } },
          variable_pay: true,
        },
      },
    },
  })

  if (appraisals.length === 0) return []

  const employeeIds = appraisals.map(a => a.employee_id)

  // Batch: self-reviews, goals, peer reviews, feedback, historical appraisals
  const historyCycleIds = publishedCycles.map(c => c.id)

  const [reviews, goals, peerReviews, feedbackCounts, historyAppraisals] = await Promise.all([
    // Self-review ratings for current cycle
    prisma.review.findMany({
      where: { cycle_id: targetCycle.id, employee_id: { in: employeeIds } },
      select: { employee_id: true, self_rating: true },
    }),

    // Goals for current cycle
    prisma.goal.findMany({
      where: { cycle_id: targetCycle.id, employee_id: { in: employeeIds } },
      select: { employee_id: true, status: true },
    }),

    // Peer reviews for current cycle
    prisma.peerReviewRequest.findMany({
      where: {
        cycle_id: targetCycle.id,
        reviewee_id: { in: employeeIds },
        status: 'submitted',
        peer_rating: { not: null },
      },
      select: { reviewee_id: true, peer_rating: true },
    }),

    // Feedback counts (all-time per employee)
    prisma.feedback.groupBy({
      by: ['to_user_id'],
      where: { to_user_id: { in: employeeIds } },
      _count: { id: true },
    }),

    // Historical appraisals across published cycles for trend + consecutive + history
    prisma.appraisal.findMany({
      where: {
        cycle_id: { in: historyCycleIds },
        employee_id: { in: employeeIds },
      },
      select: {
        employee_id: true,
        cycle_id: true,
        final_rating: true,
        mis_score: true,
        competency_score: true,
        payout_multiplier: true,
        payout_amount: true,
      },
    }),
  ])

  // Build lookup maps
  const reviewMap = new Map(reviews.map(r => [r.employee_id, r.self_rating]))

  // Goal completion: count completed/approved vs total
  const goalMap = new Map<string, { completed: number; total: number }>()
  for (const g of goals) {
    const entry = goalMap.get(g.employee_id) ?? { completed: 0, total: 0 }
    entry.total++
    if (g.status === 'completed' || g.status === 'approved') entry.completed++
    goalMap.set(g.employee_id, entry)
  }

  // Peer review average (rating tier -> numeric -> average)
  const peerMap = new Map<string, number[]>()
  for (const pr of peerReviews) {
    const num = ratingToNumeric(pr.peer_rating as string)
    if (num != null) {
      const arr = peerMap.get(pr.reviewee_id) ?? []
      arr.push(num)
      peerMap.set(pr.reviewee_id, arr)
    }
  }

  // Feedback count map
  const feedbackMap = new Map(feedbackCounts.map(f => [f.to_user_id, f._count.id]))

  // History appraisals indexed by employee -> cycle
  const historyMap = new Map<string, Map<string, (typeof historyAppraisals)[number]>>()
  for (const ha of historyAppraisals) {
    if (!historyMap.has(ha.employee_id)) historyMap.set(ha.employee_id, new Map())
    historyMap.get(ha.employee_id)!.set(ha.cycle_id, ha)
  }

  // Published cycles ordered chronologically (oldest first) for consecutive count
  const chronologicalCycles = [...publishedCycles].reverse()

  const results: TopTalentEmployee[] = []

  for (const appraisal of appraisals) {
    const emp = appraisal.employee
    if (!emp) continue

    const finalRating = appraisal.final_rating as string
    const compositeScore = appraisal.competency_score != null
      ? Number(appraisal.competency_score)
      : null
    const misScore = appraisal.mis_score != null ? Number(appraisal.mis_score) : null

    // Self rating
    const selfRating = reviewMap.get(emp.id) ?? null

    // Goal completion percentage
    const goalData = goalMap.get(emp.id)
    const goalCompletion = goalData && goalData.total > 0
      ? Math.round((goalData.completed / goalData.total) * 100)
      : 0

    // Competency average (from appraisal)
    const competencyAvg = appraisal.competency_score != null
      ? Number(appraisal.competency_score)
      : null

    // Peer review average
    const peerRatings = peerMap.get(emp.id)
    const peerReviewAvg = peerRatings && peerRatings.length > 0
      ? Math.round((peerRatings.reduce((s, v) => s + v, 0) / peerRatings.length) * 100) / 100
      : null

    // Feedback count
    const feedbackCount = feedbackMap.get(emp.id) ?? 0

    // Trend: compare current final_rating to previous cycle's final_rating
    let trend: 'up' | 'down' | 'same' | null = null
    const currentCycleIdx = publishedCycles.findIndex(c => c.id === targetCycle.id)
    if (currentCycleIdx >= 0 && currentCycleIdx < publishedCycles.length - 1) {
      const prevCycleId = publishedCycles[currentCycleIdx + 1].id
      const prevAppraisal = historyMap.get(emp.id)?.get(prevCycleId)
      if (prevAppraisal?.final_rating) {
        const currNum = ratingToNumeric(finalRating)
        const prevNum = ratingToNumeric(prevAppraisal.final_rating)
        if (currNum != null && prevNum != null) {
          if (currNum > prevNum) trend = 'up'
          else if (currNum < prevNum) trend = 'down'
          else trend = 'same'
        }
      }
    }

    // Consecutive high cycles: count backwards from current cycle
    let consecutiveHighCycles = 0
    // Walk from most recent to oldest in the published cycles list
    for (const cycle of publishedCycles) {
      const ha = historyMap.get(emp.id)?.get(cycle.id)
      if (ha?.final_rating && tiers.includes(ha.final_rating as RatingTier)) {
        consecutiveHighCycles++
      } else {
        break
      }
    }

    // Cycle history: last 5 published cycles
    const cycleHistory = publishedCycles.map(c => {
      const ha = historyMap.get(emp.id)?.get(c.id)
      return {
        cycleName: c.name,
        finalRating: ha?.final_rating ?? null,
        compositeScore: ha?.competency_score != null ? Number(ha.competency_score) : null,
      }
    })

    // Apply thresholds
    if (consecutiveHighCycles < config.min_cycles) continue
    if (config.score_threshold > 0 && (compositeScore == null || compositeScore < config.score_threshold)) continue
    if (config.mis_threshold > 0 && (misScore == null || misScore < config.mis_threshold)) continue

    results.push({
      id: emp.id,
      fullName: emp.full_name,
      email: emp.email,
      department: emp.department?.name ?? '-',
      designation: emp.designation,
      managerId: emp.manager_id,
      managerName: emp.manager?.full_name ?? null,
      currentCycle: {
        cycleId: targetCycle.id,
        cycleName: targetCycle.name,
        finalRating,
        compositeScore,
        misScore,
        payoutAmount: Number(appraisal.payout_amount ?? 0),
        multiplier: Number(appraisal.payout_multiplier ?? 0),
      },
      selfRating: selfRating ?? null,
      goalCompletion,
      competencyAvg,
      peerReviewAvg,
      feedbackCount,
      trend,
      consecutiveHighCycles,
      cycleHistory,
    })
  }

  // Sort: compositeScore desc (nulls last), then by rating tier (FEE first)
  results.sort((a, b) => {
    const scoreA = a.currentCycle.compositeScore
    const scoreB = b.currentCycle.compositeScore
    if (scoreA != null && scoreB != null) {
      if (scoreB !== scoreA) return scoreB - scoreA
    } else if (scoreA == null && scoreB != null) {
      return 1
    } else if (scoreA != null && scoreB == null) {
      return -1
    }

    const tierA = TIER_SORT_ORDER[a.currentCycle.finalRating] ?? 99
    const tierB = TIER_SORT_ORDER[b.currentCycle.finalRating] ?? 99
    return tierA - tierB
  })

  return results
}

/* ── Stats ── */

export async function fetchTopTalentStats(options?: {
  cycleId?: string
  managerId?: string
}): Promise<TopTalentStats> {
  const pool = await fetchTopTalentPool(options)

  // Total active employees in org (for percentage)
  const totalEmployees = await prisma.user.count({
    where: { is_active: true, role: { notIn: ['admin', 'hrbp'] } },
  })

  const total = pool.length
  const percentOfOrg = totalEmployees > 0 ? Math.round((total / totalEmployees) * 100 * 10) / 10 : 0

  // Average composite score
  const scoresWithValues = pool.filter(p => p.currentCycle.compositeScore != null)
  const avgScore = scoresWithValues.length > 0
    ? Math.round(
        (scoresWithValues.reduce((s, p) => s + p.currentCycle.compositeScore!, 0) / scoresWithValues.length) * 100
      ) / 100
    : 0

  // By department
  const deptCounts = new Map<string, number>()
  for (const p of pool) {
    deptCounts.set(p.department, (deptCounts.get(p.department) ?? 0) + 1)
  }
  const byDepartment = Array.from(deptCounts.entries())
    .map(([department, count]) => ({
      department,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100 * 10) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  const topDepartment = byDepartment.length > 0 ? byDepartment[0].department : null

  // By tier
  const byTier: Record<string, number> = {}
  for (const p of pool) {
    const tier = p.currentCycle.finalRating
    byTier[tier] = (byTier[tier] ?? 0) + 1
  }

  // Pool over time: count qualifying employees in each of last 5 published cycles
  const config = await fetchTopTalentConfig()
  const tiers = config.rating_tiers as RatingTier[]

  const publishedCycles = await prisma.cycle.findMany({
    where: { status: 'published' },
    orderBy: { published_at: 'desc' },
    take: 5,
    select: { id: true, name: true },
  })

  let poolOverTime: Array<{ cycleName: string; count: number }> = []

  if (publishedCycles.length > 0) {
    const cycleIds = publishedCycles.map(c => c.id)

    // Count qualifying appraisals per cycle
    const counts = await prisma.appraisal.groupBy({
      by: ['cycle_id'],
      where: {
        cycle_id: { in: cycleIds },
        is_exit_frozen: false,
        final_rating: { in: tiers },
      },
      _count: { id: true },
    })

    const countMap = new Map(counts.map(c => [c.cycle_id, c._count.id]))

    // Return in chronological order (oldest first)
    poolOverTime = [...publishedCycles].reverse().map(c => ({
      cycleName: c.name,
      count: countMap.get(c.id) ?? 0,
    }))
  }

  return {
    total,
    percentOfOrg,
    avgScore,
    topDepartment,
    byDepartment,
    byTier,
    poolOverTime,
  }
}
