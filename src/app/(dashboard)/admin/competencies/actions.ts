'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function createCompetency(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['admin', 'hrbp'])
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  if (!name) return { data: null, error: 'Name is required' }

  const existing = await prisma.competency.findUnique({ where: { name } })
  if (existing) return { data: null, error: 'A competency with this name already exists' }

  const competency = await prisma.competency.create({ data: { name, description } })
  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'competency_created',
      entity_type: 'competency',
      entity_id: competency.id,
      new_value: { name, description },
    },
  })
  revalidatePath('/admin/competencies')
  return { data: null, error: null }
}

export async function deleteCompetency(id: string): Promise<void> {
  const user = await requireRole(['admin'])
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
