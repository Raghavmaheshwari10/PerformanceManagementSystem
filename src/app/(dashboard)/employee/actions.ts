'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function submitSelfReview(formData: FormData) {
  const user = await requireRole(['employee'])
  const supabase = await createClient()

  const cycleId = formData.get('cycle_id') as string
  const selfRating = formData.get('self_rating') as string
  const selfComments = formData.get('self_comments') as string

  const { error } = await supabase.from('reviews').upsert({
    cycle_id: cycleId,
    employee_id: user.id,
    self_rating: selfRating,
    self_comments: selfComments,
    status: 'submitted',
    submitted_at: new Date().toISOString(),
  }, { onConflict: 'cycle_id,employee_id' })

  if (error) throw new Error(error.message)
  revalidatePath('/employee')
}

export async function saveDraftReview(formData: FormData) {
  const user = await requireRole(['employee'])
  const supabase = await createClient()

  const { error } = await supabase.from('reviews').upsert({
    cycle_id: formData.get('cycle_id') as string,
    employee_id: user.id,
    self_rating: formData.get('self_rating') as string || null,
    self_comments: formData.get('self_comments') as string,
    status: 'draft',
  }, { onConflict: 'cycle_id,employee_id' })

  if (error) throw new Error(error.message)
  revalidatePath('/employee')
}
