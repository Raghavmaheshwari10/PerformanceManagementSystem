'use server'

import { prisma } from '@/lib/prisma'
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
  const user = await requireRole(['admin'])
  const data = parseTemplateForm(formData)

  if (!data.role_slug) return { data: null, error: 'Role slug is required' }
  if (!data.title) return { data: null, error: 'Title is required' }

  try {
    const template = await prisma.kpiTemplate.create({ data })
    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'kpi_template_created',
        entity_type: 'kpi_template',
        entity_id: template.id,
        new_value: { title: data.title, role_slug: data.role_slug, category: data.category },
      },
    })
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to create KPI template' }
  }

  revalidatePath('/admin/kpi-templates')
  redirect('/admin/kpi-templates')
}

export async function updateKpiTemplate(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['admin'])
  const data = parseTemplateForm(formData)

  if (!data.role_slug) return { data: null, error: 'Role slug is required' }
  if (!data.title) return { data: null, error: 'Title is required' }

  try {
    await prisma.kpiTemplate.update({ where: { id }, data })
    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'kpi_template_updated',
        entity_type: 'kpi_template',
        entity_id: id,
        new_value: { title: data.title, role_slug: data.role_slug, category: data.category },
      },
    })
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to update KPI template' }
  }

  revalidatePath('/admin/kpi-templates')
  redirect('/admin/kpi-templates')
}

export async function toggleTemplateActive(id: string, current: boolean): Promise<void> {
  const user = await requireRole(['admin'])
  await prisma.kpiTemplate.update({
    where: { id },
    data: { is_active: !current },
  })
  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'kpi_template_toggled',
      entity_type: 'kpi_template',
      entity_id: id,
      new_value: { is_active: !current },
    },
  })
  revalidatePath('/admin/kpi-templates')
}
