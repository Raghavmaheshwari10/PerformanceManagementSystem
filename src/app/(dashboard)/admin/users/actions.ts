'use server'

import { prisma } from '@/lib/prisma'
import { requireRole, getCurrentUser } from '@/lib/auth'
import { fetchZimyoEmployees, transformZimyoEmployee } from '@/lib/zimyo'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ActionResult, UserRole } from '@/lib/types'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { sendInviteEmail } from '@/lib/email'

export async function triggerZimyoSync(): Promise<{ error?: string }> {
  const user = await requireRole(['admin'])

  let zimyoEmployees
  try {
    zimyoEmployees = await fetchZimyoEmployees()
  } catch (e) {
    return { error: (e as Error).message }
  }
  let added = 0, updated = 0, deactivated = 0

  const emailToId = new Map<string, string>()

  for (const emp of zimyoEmployees) {
    const transformed = transformZimyoEmployee(emp)
    const existing = await prisma.user.findUnique({
      where: { zimyo_id: transformed.zimyo_id },
      select: { id: true },
    })

    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { department: _dept, ...transformedWithoutDept } = transformed
      await prisma.user.update({
        where: { zimyo_id: transformed.zimyo_id },
        data: { ...transformedWithoutDept, is_active: true, synced_at: new Date() },
      })
      emailToId.set(transformed.email, existing.id)
      updated++
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { department: _dept, ...transformedWithoutDept } = transformed
      const newUser = await prisma.user.create({
        data: { ...transformedWithoutDept, synced_at: new Date() },
        select: { id: true, email: true },
      })
      emailToId.set(newUser.email, newUser.id)
      added++
    }
  }

  // Bulk update manager links
  const zimyoIds: string[] = []
  const managerIds: string[] = []
  for (const emp of zimyoEmployees) {
    if (emp.reporting_manager_email) {
      const managerId = emailToId.get(emp.reporting_manager_email)
      if (managerId) {
        zimyoIds.push(emp.employee_id)
        managerIds.push(managerId)
      }
    }
  }
  if (zimyoIds.length > 0) {
    await prisma.$transaction(
      zimyoIds.map((zimyoId, i) =>
        prisma.user.update({
          where: { zimyo_id: zimyoId },
          data: { manager_id: managerIds[i] },
        })
      )
    )
  }

  // Deactivate users no longer in Zimyo
  const activeZimyoIds = zimyoEmployees.map(e => e.employee_id)
  const allUsers = await prisma.user.findMany({
    where: { is_active: true },
    select: { zimyo_id: true },
  })
  const toDeactivate = allUsers
    .filter(u => !activeZimyoIds.includes(u.zimyo_id))
    .map(u => u.zimyo_id)
  if (toDeactivate.length > 0) {
    await prisma.user.updateMany({
      where: { zimyo_id: { in: toDeactivate } },
      data: { is_active: false },
    })
    deactivated = toDeactivate.length
  }

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'zimyo_sync',
      entity_type: 'user',
      new_value: { added, updated, deactivated },
    },
  })

  revalidatePath('/admin/users')
  return {}
}

export async function createUser(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireRole(['admin'])
  const admin = await getCurrentUser()

  const email         = (formData.get('email') as string)?.trim()
  const full_name     = (formData.get('full_name') as string)?.trim()
  const role          = formData.get('role') as UserRole
  const department_id = (formData.get('department_id') as string) || null
  const designation   = (formData.get('designation') as string)?.trim() || null
  const variable_pay  = parseFloat(formData.get('variable_pay') as string) || 0
  const manager_id    = (formData.get('manager_id') as string) || null
  const is_also_employee = formData.get('is_also_employee') === 'true'
  const password      = (formData.get('password') as string)?.trim()

  if (!email || !full_name || !role) return { data: null, error: 'Email, name and role are required' }

  // Password is optional — if not provided, user gets an invite email
  const password_hash = password ? await bcrypt.hash(password, 12) : null

  // Generate invite token (72hr expiry) when no password set
  const invite_token = !password ? crypto.randomBytes(32).toString('hex') : null
  const invite_token_expires_at = !password ? new Date(Date.now() + 72 * 60 * 60 * 1000) : null

  // Generate a zimyo_id placeholder for manually created users
  const zimyo_id = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const newUser = await prisma.user.create({
    data: {
      email,
      full_name,
      role: role as import('@prisma/client').UserRole,
      department_id,
      designation,
      variable_pay,
      manager_id,
      is_also_employee: role === 'hrbp' ? is_also_employee : false,
      is_active: true,
      zimyo_id,
      password_hash,
      invite_token,
      invite_token_expires_at,
      invited_at: invite_token ? new Date() : null,
    },
    select: { id: true },
  })

  // Send invite email if no password was set
  if (invite_token) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hrms.emb.global'
    const inviteUrl = `${appUrl}/login/accept-invite?token=${invite_token}`
    try {
      await sendInviteEmail(email, inviteUrl, full_name)
    } catch (err) {
      console.error('Failed to send invite email:', err)
    }
  }

  await prisma.auditLog.create({
    data: {
      changed_by: admin.id,
      action: 'user_created',
      entity_type: 'user',
      entity_id: newUser.id,
      new_value: { email, full_name, role, invited: !!invite_token },
    },
  })

  revalidatePath('/admin/users')
  redirect('/admin/users')
}

export async function updateUser(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireRole(['admin'])
  const admin = await getCurrentUser()

  const userId = formData.get('user_id') as string
  if (!userId) return { data: null, error: 'User ID missing' }

  const full_name     = (formData.get('full_name') as string)?.trim()
  const role          = formData.get('role') as UserRole
  const department_id = formData.get('department_id') as string || null
  const designation   = (formData.get('designation') as string)?.trim() || null
  const variable_pay  = parseFloat(formData.get('variable_pay') as string) || 0
  const manager_id    = formData.get('manager_id') as string || null
  const is_also_employee = formData.get('is_also_employee') === 'true'
  const is_active     = formData.get('is_active') === 'true'

  // Get old values for audit
  const old = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, department_id: true, is_active: true },
  })

  await prisma.user.update({
    where: { id: userId },
    data: {
      full_name,
      role: role as import('@prisma/client').UserRole,
      department_id,
      designation,
      variable_pay,
      manager_id,
      is_also_employee: role === 'hrbp' ? is_also_employee : false,
      is_active,
    },
  })

  // Update hrbp_departments if role is hrbp
  if (role === 'hrbp') {
    const deptIds = formData.getAll('hrbp_department_ids') as string[]
    await prisma.hrbpDepartment.deleteMany({ where: { hrbp_id: userId } })
    if (deptIds.length > 0) {
      await prisma.hrbpDepartment.createMany({
        data: deptIds.map(id => ({ hrbp_id: userId, department_id: id })),
      })
    }
  } else if (old?.role === 'hrbp') {
    // Role changed away from HRBP — clean up orphaned dept assignments
    await prisma.hrbpDepartment.deleteMany({ where: { hrbp_id: userId } })
  }

  try {
    await prisma.auditLog.create({
      data: {
        changed_by: admin.id,
        action: 'user_updated',
        entity_type: 'user',
        entity_id: userId,
        old_value: { role: old?.role, department_id: old?.department_id, is_active: old?.is_active },
        new_value: { role, department_id, is_active },
      },
    })
  } catch (e) {
    console.error('Audit log failed:', e)
  }

  revalidatePath('/admin/users')
  redirect('/admin/users')
}

export async function sendMagicLink(_prev: ActionResult<{ link: string }> | null, formData: FormData): Promise<ActionResult<{ link: string }>> {
  await requireRole(['admin'])
  // Magic link generation requires Supabase Auth admin API.
  // With Auth.js (NextAuth), users log in via credentials or OAuth.
  // This feature is no longer available after the Supabase migration.
  return { data: null, error: 'Magic links are not supported with the current auth provider. Use the password reset flow instead.' }
}

export async function sendPasswordReset(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireRole(['admin'])
  // Password reset via email requires an email provider configured in Auth.js.
  // For now, admins can set a new password directly via the admin panel.
  return { data: null, error: 'Email-based password reset is not configured. Please set the password directly.' }
}

export async function updateUserRole(userId: string, role: string): Promise<void> {
  const user = await requireRole(['admin'])

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { role: role as import('@prisma/client').UserRole },
    })
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : 'Failed to update role')
  }

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'role_change',
      entity_type: 'user',
      entity_id: userId,
      old_value: { role: target?.role },
      new_value: { role },
    },
  })

  revalidatePath('/admin/users')
}

export async function toggleUserActive(userId: string, currentActive: boolean): Promise<void> {
  const user = await requireRole(['admin'])

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { is_active: !currentActive },
    })
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : 'Failed to toggle user status')
  }

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'toggle_active',
      entity_type: 'user',
      entity_id: userId,
      old_value: { is_active: currentActive },
      new_value: { is_active: !currentActive },
    },
  })

  revalidatePath('/admin/users')
}

// ─── Invite Management ───────────────────────────────────────────────

export async function resendInvite(userId: string): Promise<ActionResult> {
  await requireRole(['admin'])

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, full_name: true, password_hash: true },
  })
  if (!user) return { data: null, error: 'User not found' }
  if (user.password_hash) return { data: null, error: 'User already has a password set' }

  const invite_token = crypto.randomBytes(32).toString('hex')
  const invite_token_expires_at = new Date(Date.now() + 72 * 60 * 60 * 1000)

  await prisma.user.update({
    where: { id: userId },
    data: { invite_token, invite_token_expires_at, invited_at: new Date() },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://hrms.emb.global'
  const inviteUrl = `${appUrl}/login/accept-invite?token=${invite_token}`
  try {
    await sendInviteEmail(user.email, inviteUrl, user.full_name)
  } catch (err) {
    return { data: null, error: `Invite saved but email failed: ${err}` }
  }

  revalidatePath('/admin/users')
  return { data: null, error: null }
}

export async function revokeInvite(userId: string): Promise<ActionResult> {
  await requireRole(['admin'])

  await prisma.user.update({
    where: { id: userId },
    data: { invite_token: null, invite_token_expires_at: null },
  })

  revalidatePath('/admin/users')
  return { data: null, error: null }
}

// ─── Delete ──────────────────────────────────────────────────────────

export async function deleteUser(userId: string): Promise<ActionResult> {
  const admin = await requireRole(['admin'])

  // Check for dependent records
  const [reviews, appraisals, kpis] = await Promise.all([
    prisma.review.count({ where: { employee_id: userId } }),
    prisma.appraisal.count({ where: { OR: [{ employee_id: userId }, { manager_id: userId }] } }),
    prisma.kpi.count({ where: { OR: [{ employee_id: userId }, { manager_id: userId }] } }),
  ])

  if (reviews > 0 || appraisals > 0 || kpis > 0) {
    return {
      data: null,
      error: `Cannot delete: user has ${reviews} review(s), ${appraisals} appraisal(s), ${kpis} KPI(s). Deactivate instead.`,
    }
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, full_name: true } })

  try {
    await prisma.$transaction([
      // Clean up all related records
      prisma.auditLog.deleteMany({ where: { changed_by: userId } }),
      prisma.notification.deleteMany({ where: { recipient_id: userId } }),
      prisma.notificationPreference.deleteMany({ where: { user_id: userId } }),
      prisma.draft.deleteMany({ where: { user_id: userId } }),
      prisma.hrbpDepartment.deleteMany({ where: { hrbp_id: userId } }),
      prisma.cycleEmployee.deleteMany({ where: { employee_id: userId } }),
      prisma.peerReviewRequest.deleteMany({ where: { OR: [{ reviewee_id: userId }, { peer_user_id: userId }, { requested_by: userId }] } }),
      prisma.goalUpdate.deleteMany({ where: { updated_by: userId } }),
      prisma.goal.deleteMany({ where: { OR: [{ employee_id: userId }, { approved_by: userId }] } }),
      prisma.feedback.deleteMany({ where: { OR: [{ from_user_id: userId }, { to_user_id: userId }] } }),
      prisma.reviewResponse.deleteMany({ where: { respondent_id: userId } }),
      prisma.kra.deleteMany({ where: { employee_id: userId } }),
      prisma.kpi.deleteMany({ where: { OR: [{ employee_id: userId }, { manager_id: userId }] } }),
      // Unlink direct reports and cycles created by this user
      prisma.user.updateMany({ where: { manager_id: userId }, data: { manager_id: null } }),
      prisma.cycle.updateMany({ where: { created_by: userId }, data: { created_by: null } }),
      prisma.user.delete({ where: { id: userId } }),
    ])
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Delete user failed:', msg)
    return { data: null, error: `Delete failed: ${msg.includes('foreign key') ? 'User has dependent records. Try deactivating instead.' : msg}` }
  }

  await prisma.auditLog.create({
    data: {
      changed_by: admin.id,
      action: 'user_deleted',
      entity_type: 'user',
      entity_id: userId,
      old_value: { email: user?.email, full_name: user?.full_name },
    },
  })

  revalidatePath('/admin/users')
  return { data: null, error: null }
}

// ─── Bulk Operations ─────────────────────────────────────────────────

export async function bulkUpdateDepartment(userIds: string[], departmentId: string | null): Promise<ActionResult> {
  const admin = await requireRole(['admin'])

  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { department_id: departmentId },
  })

  await prisma.auditLog.create({
    data: {
      changed_by: admin.id,
      action: 'bulk_department_update',
      entity_type: 'user',
      new_value: { user_count: userIds.length, department_id: departmentId },
    },
  })

  revalidatePath('/admin/users')
  return { data: null, error: null }
}

export async function bulkUpdateRole(userIds: string[], role: UserRole): Promise<ActionResult> {
  const admin = await requireRole(['admin'])

  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { role: role as import('@prisma/client').UserRole },
  })

  await prisma.auditLog.create({
    data: {
      changed_by: admin.id,
      action: 'bulk_role_update',
      entity_type: 'user',
      new_value: { user_count: userIds.length, role },
    },
  })

  revalidatePath('/admin/users')
  return { data: null, error: null }
}

export async function bulkToggleActive(userIds: string[], isActive: boolean): Promise<ActionResult> {
  const admin = await requireRole(['admin'])

  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { is_active: isActive },
  })

  await prisma.auditLog.create({
    data: {
      changed_by: admin.id,
      action: 'bulk_toggle_active',
      entity_type: 'user',
      new_value: { user_count: userIds.length, is_active: isActive },
    },
  })

  revalidatePath('/admin/users')
  return { data: null, error: null }
}

export async function bulkDeleteUsers(userIds: string[]): Promise<ActionResult> {
  const admin = await requireRole(['admin'])

  const blocked: string[] = []
  const deletable: string[] = []

  for (const userId of userIds) {
    const [reviews, appraisals] = await Promise.all([
      prisma.review.count({ where: { employee_id: userId } }),
      prisma.appraisal.count({ where: { OR: [{ employee_id: userId }, { manager_id: userId }] } }),
    ])
    if (reviews > 0 || appraisals > 0) blocked.push(userId)
    else deletable.push(userId)
  }

  if (deletable.length > 0) {
    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { recipient_id: { in: deletable } } }),
      prisma.notificationPreference.deleteMany({ where: { user_id: { in: deletable } } }),
      prisma.draft.deleteMany({ where: { user_id: { in: deletable } } }),
      prisma.hrbpDepartment.deleteMany({ where: { hrbp_id: { in: deletable } } }),
      prisma.cycleEmployee.deleteMany({ where: { employee_id: { in: deletable } } }),
      prisma.peerReviewRequest.deleteMany({ where: { OR: [{ reviewee_id: { in: deletable } }, { peer_user_id: { in: deletable } }, { requested_by: { in: deletable } }] } }),
      prisma.kpi.deleteMany({ where: { OR: [{ employee_id: { in: deletable } }, { manager_id: { in: deletable } }] } }),
      prisma.kra.deleteMany({ where: { employee_id: { in: deletable } } }),
      prisma.user.deleteMany({ where: { id: { in: deletable } } }),
    ])

    await prisma.auditLog.create({
      data: {
        changed_by: admin.id,
        action: 'bulk_delete_users',
        entity_type: 'user',
        new_value: { deleted_count: deletable.length, blocked_count: blocked.length },
      },
    })
  }

  revalidatePath('/admin/users')

  if (blocked.length > 0) {
    return {
      data: null,
      error: `Deleted ${deletable.length} user(s). ${blocked.length} user(s) have reviews/appraisals and were skipped.`,
    }
  }
  return { data: null, error: null }
}
