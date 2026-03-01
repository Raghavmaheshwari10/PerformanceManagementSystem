'use server'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'
import { revalidatePath } from 'next/cache'

export async function createDepartment(formData: FormData): Promise<ActionResult> {
  await requireRole(['admin'])
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { data: null, error: 'Name is required' }
  if (name.length > 100) return { data: null, error: 'Name must be 100 characters or fewer' }
  const supabase = await createClient()
  const { error } = await supabase.from('departments').insert({ name })
  if (error) return { data: null, error: error.message }
  revalidatePath('/admin/departments')
  return { data: null, error: null }
}

export async function renameDepartment(id: string, formData: FormData): Promise<ActionResult> {
  await requireRole(['admin'])
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { data: null, error: 'Name is required' }
  if (name.length > 100) return { data: null, error: 'Name must be 100 characters or fewer' }
  const supabase = await createClient()
  const { error } = await supabase.from('departments').update({ name }).eq('id', id)
  if (error) return { data: null, error: error.message }
  revalidatePath('/admin/departments')
  return { data: null, error: null }
}

export async function deleteDepartment(id: string): Promise<ActionResult> {
  await requireRole(['admin'])
  const supabase = await createClient()
  // Check no users assigned
  const { count } = await supabase
    .from('users').select('id', { count: 'exact', head: true })
    .eq('department_id', id)
  if ((count ?? 0) > 0)
    return { data: null, error: `Cannot delete: ${count} user(s) assigned to this department` }
  const { error } = await supabase.from('departments').delete().eq('id', id)
  if (error) return { data: null, error: error.message }
  revalidatePath('/admin/departments')
  return { data: null, error: null }
}
