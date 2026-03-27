import { prisma } from '@/lib/prisma'

/**
 * Creates KRAs for an employee from a role template.
 * Atomic: batches existence check and createMany inside a transaction.
 */
export async function applyKraTemplate(
  roleSlug: string,
  cycleId: string,
  employeeId: string
): Promise<void> {
  const templates = await prisma.kraTemplate.findMany({
    where: { role_slug: roleSlug, is_active: true },
    orderBy: { sort_order: 'asc' },
  })

  if (templates.length === 0) return

  await prisma.$transaction(async (tx) => {
    const existingKras = await tx.kra.findMany({
      where: {
        cycle_id:    cycleId,
        employee_id: employeeId,
        title:       { in: templates.map(t => t.title) },
      },
      select: { title: true },
    })
    const existingTitles = new Set(existingKras.map(k => k.title))
    const toCreate = templates.filter(t => !existingTitles.has(t.title))

    if (toCreate.length > 0) {
      await tx.kra.createMany({
        data: toCreate.map(t => ({
          cycle_id:    cycleId,
          employee_id: employeeId,
          title:       t.title,
          description: t.description,
          category:    t.category,
          weight:      t.weight,
          sort_order:  t.sort_order,
        })),
      })
    }
  })
}
