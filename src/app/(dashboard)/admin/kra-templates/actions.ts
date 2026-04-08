'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ActionResult } from '@/lib/types'

function parseKraTemplateForm(formData: FormData) {
  const departmentIds = formData.getAll('department_ids') as string[]
  return {
    title: (formData.get('title') as string).trim(),
    description: (formData.get('description') as string | null)?.trim() || null,
    category: formData.get('category') as string,
    role_slug_id: (formData.get('role_slug_id') as string | null)?.trim() || null,
    department_id: departmentIds.length === 1 ? departmentIds[0] : null, // backward compat: single dept stored in legacy FK
    department_ids: departmentIds.filter(id => id.trim()),
    weight: formData.get('weight') ? Number(formData.get('weight')) : null,
    sort_order: Number(formData.get('sort_order') || 0),
    is_active: formData.get('is_active') === 'true',
  }
}

export async function createKraTemplate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['admin'])
  const { department_ids, ...data } = parseKraTemplateForm(formData)

  if (!data.title) return { data: null, error: 'Title is required' }

  try {
    const template = await prisma.kraTemplate.create({ data })

    // Sync many-to-many departments (graceful if table not yet migrated)
    if (department_ids.length > 0) {
      try {
        await prisma.kraTemplateDepartment.createMany({
          data: department_ids.map(deptId => ({
            kra_template_id: template.id,
            department_id: deptId,
          })),
        })
      } catch { /* join table may not exist yet */ }
    }

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'kra_template_created',
        entity_type: 'kra_template',
        entity_id: template.id,
        new_value: { title: data.title, category: data.category, department_ids },
      },
    })
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to create KRA template' }
  }

  revalidatePath('/admin/kra-templates')
  redirect('/admin/kra-templates')
}

export async function updateKraTemplate(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['admin'])
  const { department_ids, ...data } = parseKraTemplateForm(formData)

  if (!data.title) return { data: null, error: 'Title is required' }

  try {
    await prisma.kraTemplate.update({ where: { id }, data })

    // Sync many-to-many departments (graceful if table not yet migrated)
    try {
      await prisma.kraTemplateDepartment.deleteMany({ where: { kra_template_id: id } })
      if (department_ids.length > 0) {
        await prisma.kraTemplateDepartment.createMany({
          data: department_ids.map(deptId => ({
            kra_template_id: id,
            department_id: deptId,
          })),
        })
      }
    } catch { /* join table may not exist yet */ }

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'kra_template_updated',
        entity_type: 'kra_template',
        entity_id: id,
        new_value: { title: data.title, category: data.category, department_ids },
      },
    })
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to update KRA template' }
  }

  revalidatePath('/admin/kra-templates')
  redirect('/admin/kra-templates')
}

export async function toggleKraTemplateActive(id: string, current: boolean): Promise<void> {
  const user = await requireRole(['admin'])
  await prisma.kraTemplate.update({
    where: { id },
    data: { is_active: !current },
  })
  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'kra_template_toggled',
      entity_type: 'kra_template',
      entity_id: id,
      new_value: { is_active: !current },
    },
  })
  revalidatePath('/admin/kra-templates')
}

export async function deleteKraTemplate(id: string): Promise<ActionResult> {
  const user = await requireRole(['admin'])
  const template = await prisma.kraTemplate.findUnique({ where: { id } })
  if (!template) return { data: null, error: 'Template not found' }
  if (template.is_protected && user.role !== 'superadmin') {
    return { data: null, error: 'This template is protected and can only be deleted by a superadmin.' }
  }
  await prisma.kraTemplate.delete({ where: { id } })
  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'kra_template_deleted',
      entity_type: 'kra_template',
      entity_id: id,
      new_value: {},
    },
  })
  revalidatePath('/admin/kra-templates')
  return { data: null, error: null }
}
