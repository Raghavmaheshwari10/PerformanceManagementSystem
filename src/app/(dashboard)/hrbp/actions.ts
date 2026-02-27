'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { getPayoutMultiplier } from '@/lib/constants'
import type { ActionResult, RatingTier } from '@/lib/types'
import { revalidatePath } from 'next/cache'

export async function overrideRating(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['hrbp'])
  const supabase = await createClient()

  const appraisalId = formData.get('appraisal_id') as string
  const cycleId = formData.get('cycle_id') as string
  const newRating = formData.get('final_rating') as RatingTier
  const justification = formData.get('justification') as string

  if (!justification?.trim()) return { data: null, error: 'Justification is required for rating overrides' }

  const { data: appraisal } = await supabase
    .from('appraisals')
    .select('*, cycles(sme_multiplier)')
    .eq('id', appraisalId)
    .single()

  if (!appraisal) return { data: null, error: 'Appraisal not found' }

  // Cross-cycle guard: ensure the appraisal belongs to the requested cycle
  if (appraisal.cycle_id !== cycleId) return { data: null, error: 'Appraisal does not belong to this cycle' }

  const smeMultiplier = (appraisal as { cycles?: { sme_multiplier?: number } }).cycles?.sme_multiplier ?? 0
  const multiplier = getPayoutMultiplier(newRating, smeMultiplier)

  const { data: employee } = await supabase
    .from('users').select('variable_pay').eq('id', appraisal.employee_id).single()

  const payoutAmount = (employee?.variable_pay ?? 0) * multiplier

  // Optimistic lock: only update if is_final is still false
  const { data: updated } = await supabase
    .from('appraisals')
    .update({
      final_rating: newRating,
      final_rating_set_by: user.id,
      payout_multiplier: multiplier,
      payout_amount: payoutAmount,
      is_final: true,
    })
    .eq('id', appraisalId)
    .eq('is_final', false)
    .select('id')

  if (!updated || updated.length === 0) return { data: null, error: 'This appraisal has already been finalised by another user' }

  await supabase.from('audit_logs').insert({
    cycle_id: appraisal.cycle_id,
    changed_by: user.id,
    action: 'rating_override',
    entity_type: 'appraisal',
    entity_id: appraisalId,
    old_value: { final_rating: appraisal.final_rating },
    new_value: { final_rating: newRating },
    justification,
  })

  revalidatePath('/hrbp/calibration')
  return { data: null, error: null }
}

export async function lockCycle(cycleId: string): Promise<ActionResult> {
  const user = await requireRole(['hrbp'])
  const supabase = await createClient()

  const { data: cycle } = await supabase
    .from('cycles')
    .select('sme_multiplier')
    .eq('id', cycleId)
    .single()

  // Single UPDATE via RPC — eliminates N+1
  const { error } = await supabase.rpc('bulk_lock_appraisals', {
    p_cycle_id: cycleId,
    p_sme_multiplier: cycle?.sme_multiplier ?? 0,
  })

  if (error) return { data: null, error: error.message }

  await supabase.from('cycles').update({ status: 'locked', updated_at: new Date().toISOString() }).eq('id', cycleId)

  await supabase.from('audit_logs').insert({
    cycle_id: cycleId,
    changed_by: user.id,
    action: 'cycle_locked',
    entity_type: 'cycle',
    entity_id: cycleId,
    new_value: { status: 'locked' },
  })

  revalidatePath('/hrbp')
  return { data: null, error: null }
}

export async function publishCycle(cycleId: string): Promise<ActionResult> {
  const user = await requireRole(['hrbp'])
  const supabase = await createClient()

  // Guard: cycle must be locked before publishing
  const { data: cycle } = await supabase
    .from('cycles')
    .select('status')
    .eq('id', cycleId)
    .single()

  if (!cycle || cycle.status !== 'locked') {
    return { data: null, error: 'Cycle must be locked before it can be published' }
  }

  await supabase.from('cycles').update({
    status: 'published',
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', cycleId)

  const { data: employees } = await supabase.from('users').select('id').eq('is_active', true)
  const notifications = (employees ?? []).map(e => ({
    recipient_id: e.id,
    type: 'cycle_published' as const,
    payload: { cycle_id: cycleId },
  }))
  if (notifications.length) await supabase.from('notifications').insert(notifications)

  await supabase.from('audit_logs').insert({
    cycle_id: cycleId,
    changed_by: user.id,
    action: 'cycle_published',
    entity_type: 'cycle',
    entity_id: cycleId,
    new_value: { status: 'published' },
  })

  revalidatePath('/hrbp')
  return { data: null, error: null }
}
