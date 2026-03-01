'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ActionResult } from '@/lib/types'

function parseTemplateForm(formData: FormData) {
  return {
    role_slug: (formData.get('role_slug') as string).trim(),
    title: (formData.get('title') as string).trim(),
    description: (formData.get('description') as string | null)?.trim() || null,
    unit: formData.get('unit') as string,
    target: formData.get('target') ? Number(formData.get('target')) : null,
    weight: formData.get('weight') ? Number(formData.get('weight')) : null,
    category: formData.get('category') as string,
    sort_order: Number(formData.get('sort_order') || 0),
    is_active: formData.get('is_active') === 'true',
  }
}

export async function createKpiTemplate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole(['admin'])
  const supabase = await createServiceClient()
  const data = parseTemplateForm(formData)

  if (!data.role_slug) return { data: null, error: 'Role slug is required' }
  if (!data.title) return { data: null, error: 'Title is required' }

  const { error } = await supabase.from('kpi_templates').insert(data)
  if (error) return { data: null, error: error.message }

  revalidatePath('/admin/kpi-templates')
  redirect('/admin/kpi-templates')
}

export async function updateKpiTemplate(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole(['admin'])
  const supabase = await createServiceClient()
  const data = parseTemplateForm(formData)

  if (!data.role_slug) return { data: null, error: 'Role slug is required' }
  if (!data.title) return { data: null, error: 'Title is required' }

  const { error } = await supabase.from('kpi_templates').update(data).eq('id', id)
  if (error) return { data: null, error: error.message }

  revalidatePath('/admin/kpi-templates')
  redirect('/admin/kpi-templates')
}

export async function toggleTemplateActive(id: string, current: boolean): Promise<void> {
  await requireRole(['admin'])
  const supabase = await createServiceClient()
  await supabase.from('kpi_templates').update({ is_active: !current }).eq('id', id)
  revalidatePath('/admin/kpi-templates')
}
