'use server'

import { requireRole } from '@/lib/auth'
import { applyKpiTemplate as applyKpiTemplateDb } from '@/lib/db/kpi-templates'
import { applyKraTemplate as applyKraTemplateDb } from '@/lib/db/kra-templates'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function applyKpiTemplate(
  roleSlugId: string,
  cycleId: string,
  employeeId: string,
): Promise<ActionResult> {
  const user = await requireRole(['manager', 'admin'])

  try {
    const count = await applyKpiTemplateDb(roleSlugId, cycleId, employeeId, user.id)
    revalidatePath(`/manager/${employeeId}/kpis`)
    if (count === 0) {
      return { data: null, error: `No KPI templates found for this role. Create templates in Admin → KPI Templates first.` }
    }
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to apply template' }
  }
}

export async function applyKraTemplate(
  roleSlugId: string,
  cycleId: string,
  employeeId: string,
): Promise<ActionResult> {
  await requireRole(['manager', 'admin'])

  try {
    const count = await applyKraTemplateDb(roleSlugId, cycleId, employeeId)
    revalidatePath(`/manager/${employeeId}/kpis`)
    if (count === 0) {
      return { data: null, error: `No KRA templates found for this role. Create templates in Admin → KRA Templates first.` }
    }
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to apply KRA template' }
  }
}
