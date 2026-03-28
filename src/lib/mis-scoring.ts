import { prisma } from '@/lib/prisma'
import type { RatingTier } from '@prisma/client'

interface KpiScore {
  kpi_id: string
  kpi_title: string
  target: number
  actual: number
  achievement_pct: number
  formula: string
  weight: number
  weighted_score: number
}

export interface EmployeeScore {
  employee_id: string
  mis_score: number
  suggested_rating: RatingTier
  kpi_scores: KpiScore[]
}

function applyFormula(formula: string, actual: number, target: number): number {
  if (target === 0) return 0
  switch (formula) {
    case 'inverse': return (target / actual) * 100
    case 'capped':  return Math.min((actual / target) * 100, 100)
    default:        return (actual / target) * 100
  }
}

async function getRatingForScore(score: number): Promise<RatingTier> {
  const configs = await prisma.scoringConfig.findMany({
    where: { is_active: true },
    orderBy: { min_score: 'desc' },
  })
  for (const c of configs) {
    if (score >= Number(c.min_score)) return c.rating_tier
  }
  return 'BE' as RatingTier
}

export async function calculateEmployeeScore(employeeId: string, cycleId: string): Promise<EmployeeScore | null> {
  const kpis = await prisma.kpi.findMany({
    where: { cycle_id: cycleId, employee_id: employeeId },
    include: {
      mis_mappings: {
        include: { aop_target: true },
      },
    },
  })

  const mappedKpis = kpis.filter(k => k.mis_mappings.length > 0)
  if (mappedKpis.length === 0) return null

  const kpiScores: KpiScore[] = []
  let totalWeight = 0

  for (const kpi of mappedKpis) {
    const mapping = kpi.mis_mappings[0]
    const target = mapping.aop_target
    const kpiWeight = Number(kpi.weight || 0)
    const currentMonth = new Date().getMonth() + 1
    const proportionalTarget = Number(target.annual_target) * (currentMonth / 12)
    const actual = Number(target.ytd_actual || 0)
    const achievement = applyFormula(mapping.score_formula, actual, proportionalTarget)

    kpiScores.push({
      kpi_id: kpi.id,
      kpi_title: kpi.title,
      target: Math.round(proportionalTarget * 100) / 100,
      actual,
      achievement_pct: Math.round(achievement * 100) / 100,
      formula: mapping.score_formula,
      weight: kpiWeight,
      weighted_score: achievement * (kpiWeight / 100),
    })
    totalWeight += kpiWeight
  }

  const rawScore = kpiScores.reduce((sum, k) => sum + k.weighted_score, 0)
  const misScore = totalWeight > 0 ? (rawScore / totalWeight) * 100 : 0
  const roundedScore = Math.round(misScore * 100) / 100
  const suggestedRating = await getRatingForScore(roundedScore)

  return { employee_id: employeeId, mis_score: roundedScore, suggested_rating: suggestedRating, kpi_scores: kpiScores }
}

export async function bulkCalculateScores(cycleId: string): Promise<number> {
  const appraisals = await prisma.appraisal.findMany({
    where: { cycle_id: cycleId },
    select: { employee_id: true },
  })
  let updated = 0
  for (const a of appraisals) {
    const score = await calculateEmployeeScore(a.employee_id, cycleId)
    if (score) {
      await prisma.appraisal.update({
        where: { cycle_id_employee_id: { cycle_id: cycleId, employee_id: a.employee_id } },
        data: { mis_score: score.mis_score, suggested_rating: score.suggested_rating },
      })
      updated++
    }
  }
  return updated
}
