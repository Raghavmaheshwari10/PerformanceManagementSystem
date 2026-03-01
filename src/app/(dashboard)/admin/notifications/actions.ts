'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export interface NotificationSummary {
  sent: number
  scope: string
}

export async function sendManualNotification(
  _prev: ActionResult<NotificationSummary>,
  formData: FormData
): Promise<ActionResult<NotificationSummary>> {
  const user = await requireRole(['admin'])
  const supabase = await createServiceClient()

  const message = (formData.get('message') as string).trim()
  const link = (formData.get('link') as string | null)?.trim() || null
  const recipientType = formData.get('recipient_type') as string

  if (!message) return { data: null, error: 'Message is required' }

  let userIds: string[] = []
  let scope = ''

  if (recipientType === 'individual') {
    const userId = formData.get('user_id') as string
    if (!userId) return { data: null, error: 'Select a user' }
    userIds = [userId]
    scope = 'individual'
  } else if (recipientType === 'role') {
    const roles = formData.getAll('roles') as string[]
    if (roles.length === 0) return { data: null, error: 'Select at least one role' }
    const { data } = await supabase.from('users').select('id').in('role', roles).eq('is_active', true)
    userIds = (data ?? []).map(u => u.id)
    scope = `role:${roles.join(',')}`
  } else if (recipientType === 'department') {
    const depts = formData.getAll('departments') as string[]
    if (depts.length === 0) return { data: null, error: 'Select at least one department' }
    const { data: deptRows } = await supabase.from('departments').select('id').in('name', depts)
    const deptIds = (deptRows ?? []).map(d => d.id)
    const { data } = await supabase.from('users').select('id').in('department_id', deptIds).eq('is_active', true)
    userIds = (data ?? []).map(u => u.id)
    scope = `dept:${depts.join(',')}`
  } else {
    const { data } = await supabase.from('users').select('id').eq('is_active', true)
    userIds = (data ?? []).map(u => u.id)
    scope = 'everyone'
  }

  if (userIds.length === 0) return { data: null, error: 'No users matched the recipient selection' }

  const notifications = userIds.map(userId => ({
    user_id: userId,
    type: 'admin_message' as const,
    payload: { message, link },
  }))

  const { error } = await supabase.from('notifications').insert(notifications)
  if (error) return { data: null, error: error.message }

  await supabase.from('audit_logs').insert({
    changed_by: user.id,
    action: 'manual_notification',
    entity_type: 'notification',
    new_value: { scope, count: userIds.length, message: message.slice(0, 100) },
  })

  revalidatePath('/admin/notifications')
  return { data: { sent: userIds.length, scope }, error: null }
}
