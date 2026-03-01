'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export async function toggleFeatureFlag(key: string, value: boolean): Promise<ActionResult> {
  try {
    await requireRole(['admin'])
    const supabase = await createClient()

    const { error } = await supabase
      .from('feature_flag_overrides')
      .upsert(
        { flag_key: key, scope: 'org', scope_id: null, value },
        { onConflict: 'flag_key,scope,scope_id' }
      )

    if (error) return { data: null, error: error.message }

    revalidatePath('/admin/feature-flags')
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to update feature flag' }
  }
}
