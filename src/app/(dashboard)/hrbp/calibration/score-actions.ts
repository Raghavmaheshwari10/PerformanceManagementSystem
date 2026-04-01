'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { calculateFinalScore, calculateGoalScore, calculateCompetencyScore, scoreToRatingTier } from '@/lib/score-engine'
import { revalidatePath } from 'next/cache'

const TIER_SCORES: Record<string, number> = { FEE: 95, EE: 80, ME: 60, SME: 40, BE: 15 }

export async function calculateCycleScores(cycleId: string): Promise<{ error?: string; count?: number }> {
  const user = await requireRole(['hrbp', 'admin'])

  // Fetch cycle to get competency weight config
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: { competency_weight: true },
  })
  const competencyWeight = cycle ? Number(cycle.competency_weight) : 20

  const appraisals = await prisma.appraisal.findMany({
    where: { cycle_id: cycleId },
    select: { id: true, employee_id: true, manager_rating: true },
  })

  let count = 0
  for (const appraisal of appraisals) {
    const [goals, peerReviews, reviewResponses] = await Promise.all([
      prisma.goal.findMany({
        where: { cycle_id: cycleId, employee_id: appraisal.employee_id, status: { in: ['approved', 'completed'] } },
        select: { weight: true, target_value: true, current_value: true },
      }),
      prisma.peerReviewRequest.findMany({
        where: { cycle_id: cycleId, reviewee_id: appraisal.employee_id, status: 'submitted' },
        select: { peer_rating: true },
      }),
      // Fetch competency assessment responses for this employee's review
      prisma.reviewResponse.findMany({
        where: {
          review: { cycle_id: cycleId, employee_id: appraisal.employee_id },
        },
        select: { rating_value: true },
      }),
    ])

    const goalScore = calculateGoalScore(
      goals.map(g => ({
        weight: g.weight ? Number(g.weight) : null,
        target_value: g.target_value ? Number(g.target_value) : null,
        current_value: g.current_value ? Number(g.current_value) : null,
      }))
    )

    const managerScore = appraisal.manager_rating ? (TIER_SCORES[appraisal.manager_rating] ?? 60) : 60

    // Calculate real competency score from review responses; fall back to manager score
    const realCompetencyScore = calculateCompetencyScore(reviewResponses)
    const competencyScore = realCompetencyScore ?? managerScore

    const peerScore = peerReviews.length > 0
      ? peerReviews.reduce((s, r) => s + (r.peer_rating ? (TIER_SCORES[r.peer_rating] ?? 60) : 60), 0) / peerReviews.length
      : null

    const finalScore = calculateFinalScore({ goalScore, managerScore, peerScore, competencyScore }, { competencyWeight })
    const finalRating = scoreToRatingTier(finalScore)

    await prisma.appraisal.update({
      where: { id: appraisal.id },
      data: { final_rating: finalRating },
    })
    count++
  }

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'scores_calculated',
      entity_type: 'cycle',
      entity_id: cycleId,
      new_value: { appraisals_scored: count },
    },
  })

  revalidatePath(`/hrbp/calibration`)
  return { count }
}
