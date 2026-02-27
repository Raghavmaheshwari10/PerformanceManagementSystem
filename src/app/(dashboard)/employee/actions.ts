'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function submitSelfReview(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['employee'])
  const supabase = await createClient()

  const cycleId = formData.get('cycle_id') as string

  // Deadline enforcement: cycle must be in self_review status and deadline not passed
  const { data: cycle } = await supabase
    .from('cycles')
    .select('status, self_review_deadline')
    .eq('id', cycleId)
    .single()

  if (!cycle || cycle.status !== 'self_review') {
    return { data: null, error: 'Cycle is not in self-review phase' }
  }
  if (cycle.self_review_deadline && new Date() > new Date(cycle.self_review_deadline)) {
    return { data: null, error: 'Self-review deadline has passed — contact your HRBP' }
  }

  const selfRating = formData.get('self_rating') as string
  const selfComments = formData.get('self_comments') as string

  const { error } = await supabase.from('reviews').upsert({
    cycle_id: cycleId,
    employee_id: user.id,
    self_rating: selfRating || null,
    self_comments: selfComments,
    status: 'submitted',
    submitted_at: new Date().toISOString(),
  }, { onConflict: 'cycle_id,employee_id' })

  if (error) return { data: null, error: error.message }

  // Notify the manager that the employee submitted their self-review
  const { data: employee } = await supabase.from('users').select('manager_id').eq('id', user.id).single()
  if (employee?.manager_id) {
    await supabase.from('notifications').insert({
      recipient_id: employee.manager_id,
      type: 'review_submitted',
      payload: { cycle_id: cycleId, employee_id: user.id },
    })
  }

  revalidatePath('/employee')
  return { data: null, error: null }
}

export async function saveDraftReview(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['employee'])
  const supabase = await createClient()

  const { error } = await supabase.from('reviews').upsert({
    cycle_id: formData.get('cycle_id') as string,
    employee_id: user.id,
    self_rating: (formData.get('self_rating') as string) || null,
    self_comments: formData.get('self_comments') as string,
    status: 'draft',
  }, { onConflict: 'cycle_id,employee_id' })

  if (error) return { data: null, error: error.message }
  revalidatePath('/employee')
  return { data: null, error: null }
}
