import { prisma } from '@/lib/prisma'

export interface RoleOption {
  value: string // UUID id
  label: string
  slug: string  // original slug for display
}

/**
 * Fetches active role slugs from the database, formatted for select dropdowns.
 * Returns the UUID id as the value (for FK references).
 */
export async function fetchRoleOptions(): Promise<RoleOption[]> {
  const roles = await prisma.roleSlug.findMany({
    where: { is_active: true },
    orderBy: [{ sort_order: 'asc' }, { label: 'asc' }],
    select: { id: true, slug: true, label: true },
  })
  return roles.map(r => ({ value: r.id, label: r.label, slug: r.slug }))
}
