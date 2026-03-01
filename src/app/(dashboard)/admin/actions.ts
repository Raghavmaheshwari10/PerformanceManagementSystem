'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { canTransition, getTransitionRequirements } from '@/lib/cycle-machine'
import { validateMultiplier } from '@/lib/validate'
import type { ActionResult, CycleStatus } from '@/lib/types'
import { revalidatePath } from 'next/cache'

export async function createCycle(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(["admin", "hrbp"])
  const supabase = await createClient()

  const smeMultiplierRaw = Number(formData.get("sme_multiplier"))
  if (!validateMultiplier(smeMultiplierRaw)) {
    return { data: null, error: "SME multiplier must be between 0 and 5" }
  }

  const businessMultiplierRaw = Number(formData.get("business_multiplier") ?? 1.0)
  if (businessMultiplierRaw < 0 || businessMultiplierRaw > 2.0) {
    return { data: null, error: "Business multiplier must be between 0 and 2.0" }
  }
  const totalBudgetRaw = formData.get("total_budget") as string
  const budgetCurrency = (formData.get("budget_currency") as string) || "INR"

  const { error } = await supabase.from("cycles").insert({
    name: formData.get("name") as string,
    quarter: formData.get("quarter") as string,
    year: Number(formData.get("year")),
    sme_multiplier: smeMultiplierRaw,
    business_multiplier: businessMultiplierRaw,
    total_budget: totalBudgetRaw ? Number(totalBudgetRaw) : null,
    budget_currency: budgetCurrency,
    kpi_setting_deadline: (formData.get("kpi_setting_deadline") as string) || null,
    self_review_deadline: (formData.get("self_review_deadline") as string) || null,
    manager_review_deadline: (formData.get("manager_review_deadline") as string) || null,
    calibration_deadline: (formData.get("calibration_deadline") as string) || null,
    created_by: user.id,
  })

  if (error) return { data: null, error: error.message }
  revalidatePath("/admin")
  return { data: null, error: null }
}

export async function advanceCycleStatus(cycleId: string, currentStatus: CycleStatus): Promise<ActionResult> {
  const user = await requireRole(["admin", "hrbp"])
  const supabase = await createClient()

  const nextMap: Record<string, CycleStatus> = {
    draft: "kpi_setting",
    kpi_setting: "self_review",
    self_review: "manager_review",
    manager_review: "calibrating",
    calibrating: "locked",
    locked: "published",
  }
  const nextStatus = nextMap[currentStatus]
  if (!nextStatus || !canTransition(currentStatus, nextStatus)) {
    return { data: null, error: `Cannot advance from ${currentStatus}` }
  }

  const req = getTransitionRequirements(currentStatus, nextStatus)
  if (!req?.allowedRoles.includes(user.role)) {
    return { data: null, error: "Not authorized for this transition" }
  }

  // Atomic check-and-set: only update if status is still currentStatus
  const updateData: Record<string, unknown> = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  }
  if (nextStatus === "published") {
    updateData.published_at = new Date().toISOString()
  }

  const { data: updated } = await supabase
    .from("cycles")
    .update(updateData)
    .eq("id", cycleId)
    .eq("status", currentStatus)
    .select("id")

  if (!updated || updated.length === 0) {
    return { data: null, error: "Cycle status has already been changed by another user — please refresh" }
  }

  await supabase.from("audit_logs").insert({
    cycle_id: cycleId,
    changed_by: user.id,
    action: "cycle_status_change",
    entity_type: "cycle",
    entity_id: cycleId,
    old_value: { status: currentStatus },
    new_value: { status: nextStatus },
  })

  revalidatePath("/admin")
  revalidatePath("/hrbp")
  return { data: null, error: null }
}
