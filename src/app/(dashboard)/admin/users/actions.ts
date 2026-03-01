'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { fetchZimyoEmployees, transformZimyoEmployee } from '@/lib/zimyo'
import { revalidatePath } from 'next/cache'

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
