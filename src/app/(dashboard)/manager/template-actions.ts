'use server'

import { requireRole } from '@/lib/auth'
import { applyKpiTemplate as applyKpiTemplateDb } from '@/lib/db/kpi-templates'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function applyKpiTemplate(
  roleSlug: string,
  cycleId: string,
  employeeId: string,
): Promise<ActionResult> {
  await requireRole(['manager', 'admin'])

  try {
    await applyKpiTemplateDb(roleSlug, cycleId, employeeId)
    revalidatePath(`/manager/${employeeId}/kpis`)
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to apply template' }
  }
}
