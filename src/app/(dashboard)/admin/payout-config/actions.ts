'use server'

import { prisma } from '@/lib/prisma'
import { requireRole, getCurrentUser } from '@/lib/auth'
import type { ActionResult, RatingTier } from '@/lib/types'
import type { RatingTier as PrismaRatingTier } from '@prisma/client'
import { revalidatePath } from 'next/cache'

export async function updatePayoutConfig(
  tier: RatingTier,
  formData: FormData
): Promise<ActionResult> {
  await requireRole(['admin'])
  const user = await getCurrentUser()
  const multiplierStr = formData.get('multiplier') as string
  const multiplier = parseFloat(multiplierStr)
  if (isNaN(multiplier) || multiplier < 0)
    return { data: null, error: 'Must be a non-negative number' }

  // Get old value for audit log
  const old = await prisma.payoutConfig.findUnique({
    where: { rating_tier: tier as PrismaRatingTier },
    select: { multiplier: true },
  })

  await prisma.payoutConfig.update({
    where: { rating_tier: tier as PrismaRatingTier },
    data: { multiplier, updated_by: user.id, updated_at: new Date() },
  })

  try {
    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'payout_config_updated',
        entity_type: 'payout_config',
        old_value: { tier, multiplier: old?.multiplier },
        new_value: { tier, multiplier },
      },
    })
  } catch (e) {
    // Don't fail the whole action just because audit log failed
    console.error('Audit log write failed:', e)
  }

  revalidatePath('/admin/payout-config')
  return { data: null, error: null }
}
