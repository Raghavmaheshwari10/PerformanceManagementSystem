import { prisma } from '@/lib/prisma'

/**
 * Creates KRAs for an employee from a role template.
 * Atomic: batches existence check and createMany inside a transaction.
 */
export async function applyKraTemplate(
  roleSlugId: string,
  cycleId: string,
  employeeId: string
): Promise<number> {
  const templates = await prisma.kraTemplate.findMany({
    where: { role_slug_id: roleSlugId, is_active: true },
    orderBy: { sort_order: 'asc' },
  })

  if (templates.length === 0) return 0

  return await prisma.$transaction(async (tx) => {
    const existingKras = await tx.kra.findMany({
      where: {
        cycle_id:    cycleId,
        employee_id: employeeId,
        title:       { in: templates.map(t => t.title) },
      },
      select: { id: true, title: true, kra_template_id: true },
    })
    const existingByTitle = new Map(existingKras.map(k => [k.title, k]))
    const toCreate = templates.filter(t => !existingByTitle.has(t.title))

    // Backfill kra_template_id on existing KRAs that were created before this feature
    for (const t of templates) {
      const existing = existingByTitle.get(t.title)
      if (existing && !existing.kra_template_id) {
        await tx.kra.update({
          where: { id: existing.id },
          data: { kra_template_id: t.id },
        })
      }
    }

    if (toCreate.length > 0) {
      await tx.kra.createMany({
        data: toCreate.map(t => ({
          cycle_id:        cycleId,
          employee_id:     employeeId,
          kra_template_id: t.id,
          title:           t.title,
          description:     t.description,
          category:        t.category,
          weight:          t.weight,
          sort_order:      t.sort_order,
        })),
      })
    }
    return toCreate.length
  })
}
