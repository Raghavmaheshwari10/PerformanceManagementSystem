'use server'

import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import {
  createOrgGoal,
  updateOrgGoal,
  deleteOrgGoal as deleteOrgGoalDb,
  createDeptGoal,
  updateDeptGoal,
  deleteDeptGoal as deleteDeptGoalDb,
  linkKpiToDeptGoal,
  unlinkKpi as unlinkKpiDb,
} from '@/lib/db/goal-cascading'
import { prisma } from '@/lib/prisma'

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

/* ── Schemas ── */

const orgGoalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  cycleId: z.string().uuid().optional(),
})

const deptGoalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  orgGoalId: z.string().uuid(),
  departmentId: z.string().uuid(),
})

/* ── Helpers ── */

function revalidateGoalPaths() {
  revalidatePath('/admin/goal-cascading')
  revalidatePath('/hrbp/goal-cascading')
  revalidatePath('/manager/goal-cascading')
}

/* ── Org Goal Actions (admin only) ── */

export async function saveOrgGoal(
  id: string | null,
  formData: { title: string; description?: string; cycleId?: string },
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  if (user.role !== 'admin') {
    return { success: false, error: 'Only admins can manage org goals' }
  }

  const parsed = orgGoalSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    let goalId: string

    if (id) {
      const updated = await updateOrgGoal(id, {
        title: parsed.data.title,
        description: parsed.data.description,
        cycleId: parsed.data.cycleId,
      })
      goalId = updated.id

      await prisma.auditLog.create({
        data: {
          changed_by: user.id,
          action: 'update_org_goal',
          entity_type: 'org_goal',
          entity_id: goalId,
          new_value: { title: parsed.data.title },
        },
      })
    } else {
      const created = await createOrgGoal({
        title: parsed.data.title,
        description: parsed.data.description,
        cycleId: parsed.data.cycleId,
        createdBy: user.id,
      })
      goalId = created.id

      await prisma.auditLog.create({
        data: {
          changed_by: user.id,
          action: 'create_org_goal',
          entity_type: 'org_goal',
          entity_id: goalId,
          new_value: { title: parsed.data.title },
        },
      })
    }

    revalidateGoalPaths()
    return { success: true, data: { id: goalId } }
  } catch {
    return { success: false, error: 'Failed to save org goal' }
  }
}

export async function removeOrgGoal(id: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (user.role !== 'admin') {
    return { success: false, error: 'Only admins can delete org goals' }
  }

  try {
    await deleteOrgGoalDb(id)

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'delete_org_goal',
        entity_type: 'org_goal',
        entity_id: id,
      },
    })

    revalidateGoalPaths()
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to delete org goal' }
  }
}

/* ── Dept Goal Actions (admin + hrbp) ── */

export async function saveDeptGoal(
  id: string | null,
  formData: {
    title: string
    description?: string
    orgGoalId: string
    departmentId: string
  },
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  if (user.role !== 'admin' && user.role !== 'hrbp') {
    return { success: false, error: 'Only admins and HRBPs can manage department goals' }
  }

  const parsed = deptGoalSchema.safeParse(formData)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }

  try {
    let goalId: string

    if (id) {
      const updated = await updateDeptGoal(id, {
        title: parsed.data.title,
        description: parsed.data.description,
      })
      goalId = updated.id

      await prisma.auditLog.create({
        data: {
          changed_by: user.id,
          action: 'update_dept_goal',
          entity_type: 'dept_goal',
          entity_id: goalId,
          new_value: { title: parsed.data.title },
        },
      })
    } else {
      const created = await createDeptGoal({
        title: parsed.data.title,
        description: parsed.data.description,
        orgGoalId: parsed.data.orgGoalId,
        departmentId: parsed.data.departmentId,
        createdBy: user.id,
      })
      goalId = created.id

      await prisma.auditLog.create({
        data: {
          changed_by: user.id,
          action: 'create_dept_goal',
          entity_type: 'dept_goal',
          entity_id: goalId,
          new_value: {
            title: parsed.data.title,
            orgGoalId: parsed.data.orgGoalId,
            departmentId: parsed.data.departmentId,
          },
        },
      })
    }

    revalidateGoalPaths()
    return { success: true, data: { id: goalId } }
  } catch {
    return { success: false, error: 'Failed to save department goal' }
  }
}

export async function removeDeptGoal(id: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (user.role !== 'admin' && user.role !== 'hrbp') {
    return { success: false, error: 'Only admins and HRBPs can delete department goals' }
  }

  try {
    await deleteDeptGoalDb(id)

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'delete_dept_goal',
        entity_type: 'dept_goal',
        entity_id: id,
      },
    })

    revalidateGoalPaths()
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to delete department goal' }
  }
}

/* ── KPI Linking Actions (manager with ownership, or admin) ── */

export async function linkKpi(
  kpiId: string,
  deptGoalId: string,
): Promise<ActionResult> {
  const user = await getCurrentUser()

  if (user.role !== 'admin') {
    // Manager must own the KPI
    const kpi = await prisma.kpi.findUnique({
      where: { id: kpiId },
      select: { manager_id: true },
    })
    if (!kpi) return { success: false, error: 'KPI not found' }
    if (kpi.manager_id !== user.id) {
      return { success: false, error: 'You can only link KPIs you manage' }
    }
  }

  try {
    await linkKpiToDeptGoal(kpiId, deptGoalId)

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'link_kpi_to_dept_goal',
        entity_type: 'kpi',
        entity_id: kpiId,
        new_value: { deptGoalId },
      },
    })

    revalidateGoalPaths()
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to link KPI' }
  }
}

export async function removeKpiLink(kpiId: string): Promise<ActionResult> {
  const user = await getCurrentUser()

  if (user.role !== 'admin') {
    const kpi = await prisma.kpi.findUnique({
      where: { id: kpiId },
      select: { manager_id: true },
    })
    if (!kpi) return { success: false, error: 'KPI not found' }
    if (kpi.manager_id !== user.id) {
      return { success: false, error: 'You can only unlink KPIs you manage' }
    }
  }

  try {
    await unlinkKpiDb(kpiId)

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'unlink_kpi',
        entity_type: 'kpi',
        entity_id: kpiId,
      },
    })

    revalidateGoalPaths()
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to unlink KPI' }
  }
}
