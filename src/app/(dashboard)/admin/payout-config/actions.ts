'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { requireRole, getCurrentUser } from '@/lib/auth'
import type { ActionResult, RatingTier } from '@/lib/types'
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

  const supabase = await createServiceClient()

  // Get old value for audit log
  const { data: old } = await supabase
    .from('payout_config')
    .select('multiplier')
    .eq('rating_tier', tier)
    .single()

  const { error } = await supabase
    .from('payout_config')
    .update({ multiplier, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq('rating_tier', tier)
  if (error) return { data: null, error: error.message }

  await supabase.from('audit_logs').insert({
    changed_by: user.id,
    action: 'payout_config_updated',
    entity_type: 'payout_config',
    entity_id: tier,
    old_value: { multiplier: old?.multiplier },
    new_value: { multiplier },
  })

  revalidatePath('/admin/payout-config')
  return { data: null, error: null }
}
