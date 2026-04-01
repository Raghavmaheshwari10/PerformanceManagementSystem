import { prisma } from '@/lib/prisma'
import type { RatingTier } from '@prisma/client'

/**
 * Locks all non-final appraisals in a cycle, computing payout amounts.
 * Replaces the bulk_lock_appraisals() PL/pgSQL RPC.
 */
export async function bulkLockAppraisals(cycleId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const configs = await tx.payoutConfig.findMany()
    const configMap = Object.fromEntries(
      configs.map(c => [c.rating_tier, Number(c.multiplier)])
    )

    // Always use global PayoutConfig — no per-cycle overrides
    const feeMultiplier = Number(configMap['FEE'] ?? 1.25)
    const eeMultiplier  = Number(configMap['EE']  ?? 1.10)
    const meMultiplier  = Number(configMap['ME']  ?? 1.00)
    const smeBase       = Number(configMap['SME'] ?? 1.00)

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
        SME: smeBase,
        BE:  0,
      }
      const payoutMultiplier = ratioMap[effectiveRating] ?? 0
      const varPay = Number(a.snapshotted_variable_pay ?? 0)
      const prorationFactor = a.is_exit_frozen ? Number(a.proration_factor ?? 1) : 1

      await tx.appraisal.update({
        where: { id: a.id },
        data: {
          final_rating:      effectiveRating,
          payout_multiplier: payoutMultiplier,
          payout_amount:     varPay * payoutMultiplier * prorationFactor,
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
