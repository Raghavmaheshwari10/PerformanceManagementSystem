'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function applyKpiTemplate(
  roleSlug: string,
  cycleId: string,
  employeeId: string,
): Promise<ActionResult> {
  const user = await requireRole(["manager", "admin"])
  const supabase = await createClient()

  const { error } = await supabase.rpc("apply_kpi_template", {
    p_role_slug: roleSlug,
    p_cycle_id: cycleId,
    p_employee_id: employeeId,
  })

  if (error) return { data: null, error: error.message }
  revalidatePath(`/manager/${employeeId}/kpis`)
  return { data: null, error: null }
}
