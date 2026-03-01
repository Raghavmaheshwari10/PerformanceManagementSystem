import { createClient } from '@/lib/supabase/server'

export type FeatureFlags = Record<string, boolean>

export async function getFeatureFlags(userId: string, role: string): Promise<FeatureFlags> {
  const supabase = await createClient()
  
  // Fetch all flag keys
  const { data: flags } = await supabase.from('feature_flags').select('key')
  if (!flags) return {}
  
  // Resolve each flag
  const entries = await Promise.all(
    flags.map(async ({ key }) => {
      const { data } = await supabase.rpc('resolve_feature_flag', {
        p_key: key,
        p_user_id: userId,
        p_role: role,
      })
      return [key, data ?? false] as [string, boolean]
    })
  )
  
  return Object.fromEntries(entries)
}

export async function getFlag(key: string, userId: string, role: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('resolve_feature_flag', {
    p_key: key,
    p_user_id: userId,
    p_role: role,
  })
  return data ?? false
}
