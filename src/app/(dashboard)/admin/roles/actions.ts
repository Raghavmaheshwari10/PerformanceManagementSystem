'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export async function createRoleSlug(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole(['admin'])

  const label = (formData.get('label') as string)?.trim()
  if (!label) return { data: null, error: 'Label is required' }

  const slugInput = (formData.get('slug') as string)?.trim()
  const slug = slugInput || slugify(label)

  if (!slug) return { data: null, error: 'Could not generate a valid slug' }

  const existing = await prisma.roleSlug.findUnique({ where: { slug } })
  if (existing) return { data: null, error: `Slug "${slug}" already exists` }

  const maxOrder = await prisma.roleSlug.aggregate({ _max: { sort_order: true } })

  await prisma.roleSlug.create({
    data: {
      slug,
      label,
      sort_order: (maxOrder._max.sort_order ?? 0) + 1,
    },
  })

  revalidatePath('/admin/roles')
  return { data: null, error: null }
}

export async function updateRoleSlug(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole(['admin'])

  const id = formData.get('id') as string
  const label = (formData.get('label') as string)?.trim()
  const slugInput = (formData.get('slug') as string)?.trim()
  const sortOrder = Number(formData.get('sort_order') ?? 0)

  if (!id || !label) return { data: null, error: 'ID and label are required' }

  const current = await prisma.roleSlug.findUnique({ where: { id } })
  if (!current) return { data: null, error: 'Role not found' }

  const slug = slugInput || current.slug

  // Check slug uniqueness if changed
  if (slug !== current.slug) {
    const dup = await prisma.roleSlug.findUnique({ where: { slug } })
    if (dup) return { data: null, error: `Slug "${slug}" already exists` }
  }

  await prisma.roleSlug.update({
    where: { id },
    data: { label, slug, sort_order: sortOrder },
  })

  revalidatePath('/admin/roles')
  return { data: null, error: null }
}

export async function toggleRoleSlug(id: string): Promise<ActionResult> {
  await requireRole(['admin'])

  const role = await prisma.roleSlug.findUnique({ where: { id } })
  if (!role) return { data: null, error: 'Role not found' }

  await prisma.roleSlug.update({
    where: { id },
    data: { is_active: !role.is_active },
  })

  revalidatePath('/admin/roles')
  return { data: null, error: null }
}

export async function deleteRoleSlug(id: string): Promise<ActionResult> {
  await requireRole(['admin'])

  const role = await prisma.roleSlug.findUnique({ where: { id } })
  if (!role) return { data: null, error: 'Role not found' }

  // Check if used by any templates
  const [kpiCount, kraCount] = await Promise.all([
    prisma.kpiTemplate.count({ where: { role_slug_id: role.id } }),
    prisma.kraTemplate.count({ where: { role_slug_id: role.id } }),
  ])

  if (kpiCount > 0 || kraCount > 0) {
    return {
      data: null,
      error: `Cannot delete — used by ${kpiCount} KPI template(s) and ${kraCount} KRA template(s). Deactivate instead.`,
    }
  }

  await prisma.roleSlug.delete({ where: { id } })

  revalidatePath('/admin/roles')
  return { data: null, error: null }
}
