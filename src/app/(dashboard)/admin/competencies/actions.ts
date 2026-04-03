'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function createCompetency(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['admin', 'hrbp'])
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const category = (formData.get('category') as string) || 'core'
  const departmentId = (formData.get('department_id') as string)?.trim() || null
  const roleSlugId = (formData.get('role_slug_id') as string)?.trim() || null

  if (!name) return { data: null, error: 'Name is required' }

  const existing = await prisma.competency.findUnique({ where: { name } })
  if (existing) return { data: null, error: 'A competency with this name already exists' }

  // Parse proficiency levels from form
  const proficiencyLevels: { band: string; label: string; description: string }[] = []
  const bands = formData.getAll('prof_band') as string[]
  const labels = formData.getAll('prof_label') as string[]
  const descs = formData.getAll('prof_description') as string[]
  for (let i = 0; i < bands.length; i++) {
    if (bands[i]?.trim()) {
      proficiencyLevels.push({
        band: bands[i].trim(),
        label: labels[i]?.trim() || bands[i].trim(),
        description: descs[i]?.trim() || '',
      })
    }
  }

  const competency = await prisma.competency.create({
    data: {
      name,
      description,
      category,
      department_id: departmentId,
      role_slug_id: roleSlugId,
      proficiency_levels: proficiencyLevels.length > 0 ? proficiencyLevels : undefined,
    },
  })
  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'competency_created',
      entity_type: 'competency',
      entity_id: competency.id,
      new_value: { name, category, department_id: departmentId, role_slug_id: roleSlugId },
    },
  })
  revalidatePath('/admin/competencies')
  return { data: null, error: null }
}

export async function updateCompetency(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['admin', 'hrbp'])
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const category = (formData.get('category') as string) || 'core'
  const departmentId = (formData.get('department_id') as string)?.trim() || null
  const roleSlugId = (formData.get('role_slug_id') as string)?.trim() || null
  const isActive = formData.get('is_active') === 'true'

  if (!name) return { data: null, error: 'Name is required' }

  // Parse proficiency levels
  const proficiencyLevels: { band: string; label: string; description: string }[] = []
  const bands = formData.getAll('prof_band') as string[]
  const labels = formData.getAll('prof_label') as string[]
  const descs = formData.getAll('prof_description') as string[]
  for (let i = 0; i < bands.length; i++) {
    if (bands[i]?.trim()) {
      proficiencyLevels.push({
        band: bands[i].trim(),
        label: labels[i]?.trim() || bands[i].trim(),
        description: descs[i]?.trim() || '',
      })
    }
  }

  try {
    await prisma.competency.update({
      where: { id },
      data: {
        name,
        description,
        category,
        department_id: departmentId,
        role_slug_id: roleSlugId,
        is_active: isActive,
        proficiency_levels: proficiencyLevels.length > 0 ? proficiencyLevels : undefined,
      },
    })
    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'competency_updated',
        entity_type: 'competency',
        entity_id: id,
        new_value: { name, category },
      },
    })
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to update competency' }
  }

  revalidatePath('/admin/competencies')
  return { data: null, error: null }
}

export async function toggleCompetencyActive(id: string, current: boolean): Promise<void> {
  const user = await requireRole(['admin'])
  await prisma.competency.update({
    where: { id },
    data: { is_active: !current },
  })
  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'competency_toggled',
      entity_type: 'competency',
      entity_id: id,
      new_value: { is_active: !current },
    },
  })
  revalidatePath('/admin/competencies')
}

export async function deleteCompetency(id: string): Promise<void> {
  const user = await requireRole(['admin'])

  // Check if used by review questions
  const usageCount = await prisma.reviewQuestion.count({ where: { competency_id: id } })
  if (usageCount > 0) {
    // Can't throw in server actions easily, just log
    console.warn(`Cannot delete competency ${id}: used by ${usageCount} review questions`)
    return
  }

  await prisma.competency.delete({ where: { id } })
  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'competency_deleted',
      entity_type: 'competency',
      entity_id: id,
      new_value: {},
    },
  })
  revalidatePath('/admin/competencies')
}
