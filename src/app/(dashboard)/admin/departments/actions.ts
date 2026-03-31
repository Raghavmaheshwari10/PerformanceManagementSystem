'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'
import { revalidatePath } from 'next/cache'

export async function createDepartment(formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['admin'])
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { data: null, error: 'Name is required' }
  if (name.length > 100) return { data: null, error: 'Name must be 100 characters or fewer' }

  try {
    const dept = await prisma.department.create({ data: { name } })
    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'department_created',
        entity_type: 'department',
        entity_id: dept.id,
        new_value: { name },
      },
    })
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to create department' }
  }

  revalidatePath('/admin/departments')
  return { data: null, error: null }
}

export async function renameDepartment(id: string, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['admin'])
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { data: null, error: 'Name is required' }
  if (name.length > 100) return { data: null, error: 'Name must be 100 characters or fewer' }

  try {
    await prisma.department.update({ where: { id }, data: { name } })
    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'department_renamed',
        entity_type: 'department',
        entity_id: id,
        new_value: { name },
      },
    })
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to rename department' }
  }

  revalidatePath('/admin/departments')
  return { data: null, error: null }
}

export async function deleteDepartment(id: string): Promise<ActionResult> {
  const user = await requireRole(['admin'])

  // Check no users assigned
  const count = await prisma.user.count({ where: { department_id: id } })
  if (count > 0) {
    return { data: null, error: `Cannot delete: ${count} user(s) assigned to this department` }
  }

  try {
    await prisma.department.delete({ where: { id } })
    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'department_deleted',
        entity_type: 'department',
        entity_id: id,
        new_value: {},
      },
    })
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to delete department' }
  }

  revalidatePath('/admin/departments')
  return { data: null, error: null }
}
