'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'

export async function toggleFeatureFlag(key: string, value: boolean) {
  await requireRole(['admin'])
  const supabase = await createClient()
  
  await supabase
    .from('feature_flag_overrides')
    .upsert(
      { flag_key: key, scope: 'org', scope_id: null, value },
      { onConflict: 'flag_key,scope,scope_id' }
    )
  
  revalidatePath('/admin/feature-flags')
}
