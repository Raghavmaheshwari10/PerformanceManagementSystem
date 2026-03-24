import { prisma } from '@/lib/prisma'

/**
 * Creates KPIs for an employee from a role template.
 * Replaces the apply_kpi_template() PL/pgSQL RPC.
 * Atomic: batches existence check and createMany inside a transaction.
 */
export async function applyKpiTemplate(
  roleSlug: string,
  cycleId: string,
  employeeId: string
): Promise<void> {
  const employee = await prisma.user.findUnique({ where: { id: employeeId } })
  if (!employee?.manager_id) {
    throw new Error(`Employee ${employeeId} has no manager assigned`)
  }

  const templates = await prisma.kpiTemplate.findMany({
    where: { role_slug: roleSlug, is_active: true },
    orderBy: { sort_order: 'asc' },
  })

  if (templates.length === 0) return

  await prisma.$transaction(async (tx) => {
    const existingKpis = await tx.kpi.findMany({
      where: {
        cycle_id:    cycleId,
        employee_id: employeeId,
        title:       { in: templates.map(t => t.title) },
      },
      select: { title: true },
    })
    const existingTitles = new Set(existingKpis.map(k => k.title))
    const toCreate = templates.filter(t => !existingTitles.has(t.title))

    if (toCreate.length > 0) {
      await tx.kpi.createMany({
        data: toCreate.map(t => ({
          cycle_id:    cycleId,
          employee_id: employeeId,
          manager_id:  employee.manager_id!,
          title:       t.title,
          description: t.description,
          weight:      t.weight,
        })),
      })
    }
  })
}
