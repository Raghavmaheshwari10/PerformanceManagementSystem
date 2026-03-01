'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { requireRole, getCurrentUser } from '@/lib/auth'
import { fetchZimyoEmployees, transformZimyoEmployee } from '@/lib/zimyo'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ActionResult, UserRole } from '@/lib/types'

export async function triggerZimyoSync(): Promise<{ error?: string }> {
  const user = await requireRole(['admin'])
  const supabase = await createServiceClient()

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
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('zimyo_id', transformed.zimyo_id)
      .single()

    if (existing) {
      await supabase.from('users').update({ ...transformed, is_active: true, synced_at: new Date().toISOString() }).eq('zimyo_id', transformed.zimyo_id)
      emailToId.set(transformed.email, existing.id)
      updated++
    } else {
      const { data: newUser } = await supabase.from('users').insert({ ...transformed, synced_at: new Date().toISOString() }).select('id, email').single()
      if (newUser) emailToId.set(newUser.email, newUser.id)
      added++
    }
  }

  // Build parallel arrays for bulk RPC — single UPDATE with unnest
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
    await supabase.rpc('bulk_update_manager_links', {
      p_zimyo_ids: zimyoIds,
      p_manager_ids: managerIds,
    })
  }

  // Deactivate users no longer in Zimyo
  const activeZimyoIds = zimyoEmployees.map(e => e.employee_id)
  const { data: allUsers } = await supabase.from('users').select('zimyo_id').eq('is_active', true)
  const toDeactivate = (allUsers ?? []).filter(u => !activeZimyoIds.includes(u.zimyo_id)).map(u => u.zimyo_id)
  if (toDeactivate.length > 0) {
    await supabase.from('users').update({ is_active: false }).in('zimyo_id', toDeactivate)
    deactivated = toDeactivate.length
  }

  await supabase.from('audit_logs').insert({
    changed_by: user.id,
    action: 'zimyo_sync',
    entity_type: 'user',
    new_value: { added, updated, deactivated },
  })

  revalidatePath('/admin/users')
  return {}
}

export async function createUser(formData: FormData): Promise<ActionResult> {
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
  const send_invite   = formData.get('send_invite') === 'true'

  if (!email || !full_name || !role) return { data: null, error: 'Email, name and role are required' }

  const svc = await createServiceClient()

  // Create auth user
  const { data: authData, error: authErr } = await svc.auth.admin.createUser({
    email,
    email_confirm: true,
  })
  if (authErr) return { data: null, error: authErr.message }

  // Insert public user
  const { error: insertErr } = await svc.from('users').insert({
    id: authData.user.id,
    email,
    full_name,
    role,
    department_id,
    designation,
    variable_pay,
    manager_id,
    is_also_employee: role === 'hrbp' ? is_also_employee : false,
    is_active: true,
  })
  if (insertErr) {
    // Cleanup: delete the auth user if public user insert fails
    await svc.auth.admin.deleteUser(authData.user.id)
    return { data: null, error: insertErr.message }
  }

  // Send magic link if requested
  if (send_invite) {
    const { error: linkErr } = await svc.auth.admin.generateLink({ type: 'magiclink', email })
    if (linkErr) console.error('Magic link send failed:', linkErr.message)
  }

  // Audit log
  await svc.from('audit_logs').insert({
    changed_by: admin.id,
    action: 'user_created',
    entity_type: 'user',
    entity_id: authData.user.id,
    new_value: { email, full_name, role },
  })

  revalidatePath('/admin/users')
  redirect('/admin/users')
}

export async function updateUserRole(userId: string, role: string): Promise<void> {
  const user = await requireRole(['admin'])
  const supabase = await createServiceClient()

  const { data: target } = await supabase.from('users').select('role').eq('id', userId).single()

  await supabase.from('users').update({ role }).eq('id', userId)

  await supabase.from('audit_logs').insert({
    changed_by: user.id,
    action: 'role_change',
    entity_type: 'user',
    entity_id: userId,
    old_value: { role: target?.role },
    new_value: { role },
  })

  revalidatePath('/admin/users')
}

export async function toggleUserActive(userId: string, currentActive: boolean): Promise<void> {
  const user = await requireRole(['admin'])
  const supabase = await createServiceClient()

  await supabase.from('users').update({ is_active: !currentActive }).eq('id', userId)

  await supabase.from('audit_logs').insert({
    changed_by: user.id,
    action: 'toggle_active',
    entity_type: 'user',
    entity_id: userId,
    old_value: { is_active: currentActive },
    new_value: { is_active: !currentActive },
  })

  revalidatePath('/admin/users')
}
