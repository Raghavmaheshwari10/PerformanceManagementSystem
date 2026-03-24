import type { RatingTier } from '@prisma/client'

interface ScoreInputs {
  goalScore: number
  managerScore: number
  peerScore: number | null
  competencyScore: number
}

/**
 * Calculates weighted final score (0–100).
 * Default weights: goal 50%, competency 20%, manager 20%, peer 10%.
 * If peer score is missing, its 10% weight is redistributed to goal (making goal 60%).
 */
export function calculateFinalScore(inputs: ScoreInputs): number {
  const { goalScore, managerScore, peerScore, competencyScore } = inputs

  let score: number
  if (peerScore !== null) {
    score = goalScore * 0.50 + competencyScore * 0.20 + managerScore * 0.20 + peerScore * 0.10
  } else {
    score = goalScore * 0.60 + competencyScore * 0.20 + managerScore * 0.20
  }

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
