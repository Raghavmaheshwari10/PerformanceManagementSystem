'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { calculateFinalScore, calculateGoalScore, scoreToRatingTier } from '@/lib/score-engine'
import { revalidatePath } from 'next/cache'

const TIER_SCORES: Record<string, number> = { FEE: 95, EE: 80, ME: 60, SME: 40, BE: 15 }

export async function calculateCycleScores(cycleId: string): Promise<{ error?: string; count?: number }> {
  await requireRole(['hrbp', 'admin'])

  const appraisals = await prisma.appraisal.findMany({
    where: { cycle_id: cycleId },
    select: { id: true, employee_id: true, manager_rating: true },
  })

  let count = 0
  for (const appraisal of appraisals) {
    const [goals, peerReviews] = await Promise.all([
      prisma.goal.findMany({
        where: { cycle_id: cycleId, employee_id: appraisal.employee_id, status: { in: ['approved', 'completed'] } },
        select: { weight: true, target_value: true, current_value: true },
      }),
      prisma.peerReviewRequest.findMany({
        where: { cycle_id: cycleId, reviewee_id: appraisal.employee_id, status: 'submitted' },
        select: { peer_rating: true },
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
    const competencyScore = managerScore // fallback: use manager score

    const peerScore = peerReviews.length > 0
      ? peerReviews.reduce((s, r) => s + (r.peer_rating ? (TIER_SCORES[r.peer_rating] ?? 60) : 60), 0) / peerReviews.length
      : null

    const finalScore = calculateFinalScore({ goalScore, managerScore, peerScore, competencyScore })
    const finalRating = scoreToRatingTier(finalScore)

    await prisma.appraisal.update({
      where: { id: appraisal.id },
      data: { final_rating: finalRating },
    })
    count++
  }

  revalidatePath(`/hrbp/calibration`)
  return { count }
}
