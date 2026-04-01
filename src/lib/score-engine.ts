import type { RatingTier } from '@prisma/client'

interface ScoreInputs {
  goalScore: number
  managerScore: number
  peerScore: number | null // kept for interface compatibility — not used in calculation
  competencyScore: number
}

interface ScoreWeights {
  competencyWeight?: number // 0-100 percentage for competency; remainder split between goals and manager
}

/**
 * Calculates weighted final score (0–100).
 * Default weights: goal 60%, competency 20%, manager 20%.
 * When competencyWeight is provided (from cycle config), the non-competency portion
 * is split: 75% goals / 25% manager review.
 * Peer review score is disabled — weight redistributed to goals.
 */
export function calculateFinalScore(inputs: ScoreInputs, weights?: ScoreWeights): number {
  const { goalScore, managerScore, competencyScore } = inputs

  const compPct = (weights?.competencyWeight ?? 20) / 100
  const nonCompPct = 1 - compPct
  // Split non-competency portion: 75% goals, 25% manager
  const goalPct = nonCompPct * 0.75
  const managerPct = nonCompPct * 0.25

  const score = goalScore * goalPct + competencyScore * compPct + managerScore * managerPct

  return Math.min(100, Math.max(0, Math.round(score * 100) / 100))
}

/**
 * Maps a 0–100 score to a RatingTier.
 * FEE >= 90, EE >= 70, ME >= 50, SME >= 30, BE < 30
 */
export function scoreToRatingTier(score: number): RatingTier {
  if (score >= 90) return 'FEE'
  if (score >= 70) return 'EE'
  if (score >= 50) return 'ME'
  if (score >= 30) return 'SME'
  return 'BE'
}

/**
 * Calculates a 0–100 competency score from review response ratings.
 * Maps 1-5 ratings to 20-100 scale (1=20, 2=40, 3=60, 4=80, 5=100).
 * Returns null if no rated responses exist.
 */
export function calculateCompetencyScore(
  responses: Array<{ rating_value: number | null }>
): number | null {
  const rated = responses.filter(r => r.rating_value != null && r.rating_value >= 1 && r.rating_value <= 5)
  if (rated.length === 0) return null

  const sum = rated.reduce((acc, r) => acc + r.rating_value! * 20, 0)
  return Math.round((sum / rated.length) * 100) / 100
}

/**
 * Calculates a 0–100 goal score from an array of goals.
 * Only goals with both weight and target_value are included.
 * Achievement per goal is capped at 100%.
 */
export function calculateGoalScore(
  goals: Array<{ weight: number | null; target_value: number | null; current_value: number | null }>
): number {
  const eligible = goals.filter(g => g.weight != null && g.target_value != null && Number(g.weight) > 0)
  if (eligible.length === 0) return 0

  let totalWeight = 0
  let weightedSum = 0

  for (const goal of eligible) {
    const w = Number(goal.weight!)
    const achievement = goal.current_value != null
      ? Math.min(100, (Number(goal.current_value) / Number(goal.target_value!)) * 100)
      : 0
    weightedSum += w * achievement
    totalWeight += w
  }

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0
}
