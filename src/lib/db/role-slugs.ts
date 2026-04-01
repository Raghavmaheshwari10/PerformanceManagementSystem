import { prisma } from '@/lib/prisma'

export interface RoleOption {
  value: string
  label: string
}

/**
 * Fetches active role slugs from the database, formatted for select dropdowns.
 * Falls back to empty array if no roles are defined yet.
 */
export async function fetchRoleOptions(): Promise<RoleOption[]> {
  const roles = await prisma.roleSlug.findMany({
    where: { is_active: true },
    orderBy: [{ sort_order: 'asc' }, { label: 'asc' }],
    select: { slug: true, label: true },
  })
  return roles.map(r => ({ value: r.slug, label: r.label }))
}
