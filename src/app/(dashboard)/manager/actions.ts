'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole, requireManagerOwnership } from '@/lib/auth'
import { validateWeight } from '@/lib/validate'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function addKpi(formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['manager'])
  const employeeId = formData.get('employee_id') as string

  await requireManagerOwnership(employeeId, user.id)

  const rawWeight = formData.get('weight')
  const weight = rawWeight ? Number(rawWeight) : null
  if (weight !== null && !validateWeight(weight)) {
    return { data: null, error: 'Weight must be between 1 and 100' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('kpis').insert({
    cycle_id: formData.get('cycle_id') as string,
    employee_id: employeeId,
    manager_id: user.id,
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || null,
    weight,
  })

  if (error) return { data: null, error: error.message }
  revalidatePath(`/manager/${employeeId}/kpis`)
  return { data: null, error: null }
}

export async function deleteKpi(kpiId: string, employeeId: string): Promise<ActionResult> {
  const user = await requireRole(['manager'])
  await requireManagerOwnership(employeeId, user.id)
  const supabase = await createClient()
  const { error } = await supabase.from('kpis').delete().eq('id', kpiId)
  if (error) return { data: null, error: error.message }
  revalidatePath(`/manager/${employeeId}/kpis`)
  return { data: null, error: null }
}

export async function submitManagerRating(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['manager'])
  const employeeId = formData.get('employee_id') as string

  await requireManagerOwnership(employeeId, user.id)

  const cycleId = formData.get('cycle_id') as string
  const supabase = await createClient()

  // Deadline check: cycle must be in manager_review status and deadline not passed
  const { data: cycle } = await supabase
    .from('cycles')
    .select('status, manager_review_deadline')
    .eq('id', cycleId)
    .single()

  if (!cycle || cycle.status !== 'manager_review') {
    return { data: null, error: 'Cycle is not in manager review phase' }
  }
  if (cycle.manager_review_deadline && new Date() > new Date(cycle.manager_review_deadline)) {
    return { data: null, error: 'Manager review deadline has passed — contact your HRBP' }
  }

  const rating = formData.get('manager_rating') as string
  const comments = formData.get('manager_comments') as string

  const { error } = await supabase.from('appraisals').upsert({
    cycle_id: cycleId,
    employee_id: employeeId,
    manager_id: user.id,
    manager_rating: rating,
    manager_comments: comments,
    manager_submitted_at: new Date().toISOString(),
  }, { onConflict: 'cycle_id,employee_id' })

  if (error) return { data: null, error: error.message }
  revalidatePath('/manager')
  return { data: null, error: null }
}
