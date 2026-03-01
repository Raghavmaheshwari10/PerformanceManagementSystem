'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function snoozeNotification(id: string, until: string) {
  const supabase = await createClient()
  await supabase.from('notifications').update({ snoozed_until: until }).eq('id', id)
  revalidatePath('/', 'layout')
}

export async function dismissNotification(id: string) {
  const supabase = await createClient()
  await supabase.from('notifications').update({ dismissed_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/', 'layout')
}

export async function markAllNotificationsRead() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .is('dismissed_at', null)
  revalidatePath('/', 'layout')
}
