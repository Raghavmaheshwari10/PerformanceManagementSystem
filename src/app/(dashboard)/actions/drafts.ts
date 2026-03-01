'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export async function saveDraft(
  entityType: string,
  entityId: string | null,
  formData: Record<string, unknown>
): Promise<ActionResult> {
  try {
    await requireRole(['employee', 'manager', 'hrbp', 'admin'])
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    await supabase.from('drafts').upsert(
      {
        user_id: user.id,
        entity_type: entityType,
        entity_id: entityId,
        form_data: formData,
      },
      { onConflict: 'user_id,entity_type,entity_id' }
    )
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Save failed' }
  }
}

export async function loadDraft(
  entityType: string,
  entityId: string | null
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    await requireRole(['employee', 'manager', 'hrbp', 'admin'])
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const query = supabase
      .from('drafts')
      .select('form_data')
      .eq('user_id', user.id)
      .eq('entity_type', entityType)

    if (entityId) {
      query.eq('entity_id', entityId)
    } else {
      query.is('entity_id', null)
    }

    const { data } = await query.maybeSingle()
    return { data: data?.form_data ?? null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Load failed' }
  }
}

export async function clearDraft(
  entityType: string,
  entityId: string | null
): Promise<ActionResult> {
  try {
    await requireRole(['employee', 'manager', 'hrbp', 'admin'])
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: null, error: 'Not authenticated' }

    const query = supabase
      .from('drafts')
      .delete()
      .eq('user_id', user.id)
      .eq('entity_type', entityType)

    if (entityId) {
      query.eq('entity_id', entityId)
    } else {
      query.is('entity_id', null)
    }

    await query
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Clear failed' }
  }
}
