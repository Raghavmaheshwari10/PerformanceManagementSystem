import { prisma } from '@/lib/prisma'

/**
 * Creates KPIs for an employee from a role template.
 * Automatically assigns KPIs to matching KRAs by category.
 * Returns the number of KPIs created.
 */
export async function applyKpiTemplate(
  roleSlug: string,
  cycleId: string,
  employeeId: string,
  currentUserId: string,
): Promise<number> {
  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { manager_id: true },
  })
  // Use employee's manager, or fall back to current user (admin acting as manager)
  const managerId = employee?.manager_id ?? currentUserId

  const templates = await prisma.kpiTemplate.findMany({
    where: { role_slug: roleSlug, is_active: true },
    include: { kra_template: { select: { title: true } } },
    orderBy: { sort_order: 'asc' },
  })

  if (templates.length === 0) return 0

  return await prisma.$transaction(async (tx) => {
    // Fetch existing KRAs — build lookup maps for matching
    const kras = await tx.kra.findMany({
      where: { cycle_id: cycleId, employee_id: employeeId },
      select: { id: true, title: true, kra_template_id: true, category: true },
    })
    const kraByTemplateId = new Map(
      kras.filter(k => k.kra_template_id).map(k => [k.kra_template_id!, k.id])
    )
    const kraByTitle = new Map(kras.map(k => [k.title, k.id]))
    const kraByCategory = new Map(kras.map(k => [k.category, k.id]))

    // Helper: resolve KRA ID for a template
    function resolveKraId(t: typeof templates[number]): string | null {
      return (t.kra_template_id && kraByTemplateId.get(t.kra_template_id))
        ?? (t.kra_template?.title && kraByTitle.get(t.kra_template.title))
        ?? kraByCategory.get(t.category)
        ?? null
    }

    const existingKpis = await tx.kpi.findMany({
      where: {
        cycle_id:    cycleId,
        employee_id: employeeId,
        title:       { in: templates.map(t => t.title) },
      },
      select: { id: true, title: true, kra_id: true },
    })
    const existingByTitle = new Map(existingKpis.map(k => [k.title, k]))

    // Reassign orphaned KPIs (kra_id is null) to matching KRAs
    for (const t of templates) {
      const existing = existingByTitle.get(t.title)
      if (existing && !existing.kra_id) {
        const kraId = resolveKraId(t)
        if (kraId) {
          await tx.kpi.update({
            where: { id: existing.id },
            data: { kra_id: kraId },
          })
        }
      }
    }

    const existingTitles = new Set(existingKpis.map(k => k.title))
    const toCreate = templates.filter(t => !existingTitles.has(t.title))

    if (toCreate.length > 0) {
      await tx.kpi.createMany({
        data: toCreate.map(t => ({
          cycle_id:    cycleId,
          employee_id: employeeId,
          manager_id:  managerId,
          kra_id:      resolveKraId(t),
          title:       t.title,
          description: t.description,
          weight:      t.weight,
        })),
      })
    }
    return toCreate.length + [...existingByTitle.values()].filter(k => !k.kra_id).length
  })
}
