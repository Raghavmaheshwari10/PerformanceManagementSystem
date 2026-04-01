import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { RolesClient } from './roles-client'

export default async function AdminRolesPage() {
  await requireRole(['admin'])

  const rolesRaw = await prisma.roleSlug.findMany({
    orderBy: [{ sort_order: 'asc' }, { label: 'asc' }],
  })

  // Count template usage for each slug
  const [kpiCounts, kraCounts] = await Promise.all([
    prisma.kpiTemplate.groupBy({ by: ['role_slug'], _count: true }),
    prisma.kraTemplate.groupBy({ by: ['role_slug'], _count: true }),
  ])

  const kpiMap = Object.fromEntries(kpiCounts.map(c => [c.role_slug, c._count]))
  const kraMap = Object.fromEntries(
    kraCounts
      .filter(c => c.role_slug != null)
      .map(c => [c.role_slug!, c._count])
  )

  const roles = rolesRaw.map(r => ({
    id: r.id,
    slug: r.slug,
    label: r.label,
    sort_order: r.sort_order,
    is_active: r.is_active,
    kpi_count: kpiMap[r.slug] ?? 0,
    kra_count: kraMap[r.slug] ?? 0,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Roles</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage role slugs used to organize KPI and KRA templates by role.
        </p>
      </div>
      <RolesClient roles={roles} />
    </div>
  )
}
