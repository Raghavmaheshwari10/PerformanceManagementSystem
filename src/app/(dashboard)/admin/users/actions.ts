'use server'

import { prisma } from '@/lib/prisma'
import { requireRole, getCurrentUser } from '@/lib/auth'
import { fetchZimyoEmployees, transformZimyoEmployee } from '@/lib/zimyo'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ActionResult, UserRole } from '@/lib/types'
import bcrypt from 'bcryptjs'

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
  if (!password) return { data: null, error: 'Password is required' }

  const password_hash = await bcrypt.hash(password, 12)

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
    },
    select: { id: true },
  })

  await prisma.auditLog.create({
    data: {
      changed_by: admin.id,
      action: 'user_created',
      entity_type: 'user',
      entity_id: newUser.id,
      new_value: { email, full_name, role },
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
