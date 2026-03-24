import { prisma } from '@/lib/prisma'
import type { RatingTier } from '@prisma/client'

/**
 * Locks all non-final appraisals in a cycle, computing payout amounts.
 * Replaces the bulk_lock_appraisals() PL/pgSQL RPC.
 */
export async function bulkLockAppraisals(cycleId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const cycle = await tx.cycle.findUniqueOrThrow({ where: { id: cycleId } })
    const configs = await tx.payoutConfig.findMany()
    const configMap = Object.fromEntries(
      configs.map(c => [c.rating_tier, Number(c.multiplier)])
    )

    const feeMultiplier = Number(cycle.fee_multiplier ?? configMap['FEE'] ?? 1.25)
    const eeMultiplier  = Number(cycle.ee_multiplier  ?? configMap['EE']  ?? 1.10)
    const meMultiplier  = Number(cycle.me_multiplier  ?? configMap['ME']  ?? 1.00)
    const smeBase       = Number(configMap['SME'] ?? 1.00)
    const smeExtra      = Number(cycle.sme_multiplier ?? 0)
    const bizMultiplier = Number(cycle.business_multiplier ?? 1.0)

    const appraisals = await tx.appraisal.findMany({
      where: {
        cycle_id: cycleId,
        is_final: false,
        OR: [
          { final_rating: { not: null } },
          { manager_rating: { not: null } },
        ],
      },
    })

    for (const a of appraisals) {
      const effectiveRating = (a.final_rating ?? a.manager_rating) as RatingTier | null
      if (!effectiveRating) continue

      const ratioMap: Record<RatingTier, number> = {
        FEE: feeMultiplier,
        EE:  eeMultiplier,
        ME:  meMultiplier,
        SME: smeBase + smeExtra,
        BE:  0,
      }
      const ratio = ratioMap[effectiveRating] ?? 0
      const payoutMultiplier = ratio * bizMultiplier
      const varPay = Number(a.snapshotted_variable_pay ?? 0)

      await tx.appraisal.update({
        where: { id: a.id },
        data: {
          final_rating:      effectiveRating,
          payout_multiplier: payoutMultiplier,
          payout_amount:     varPay * payoutMultiplier,
          locked_at:         new Date(),
        },
      })
    }

    await tx.appraisal.updateMany({
      where: { cycle_id: cycleId, is_final: true, locked_at: null },
      data: { locked_at: new Date() },
    })
  })
}
