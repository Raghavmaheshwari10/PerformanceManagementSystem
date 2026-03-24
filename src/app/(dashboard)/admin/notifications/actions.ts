'use server'

import { prisma } from '@/lib/prisma'
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
    const users = await prisma.user.findMany({
      where: { role: { in: roles as import('@prisma/client').UserRole[] }, is_active: true },
      select: { id: true },
    })
    userIds = users.map(u => u.id)
    scope = `role:${roles.join(',')}`
  } else if (recipientType === 'department') {
    const depts = formData.getAll('departments') as string[]
    if (depts.length === 0) return { data: null, error: 'Select at least one department' }
    const deptRows = await prisma.department.findMany({
      where: { name: { in: depts } },
      select: { id: true },
    })
    const deptIds = deptRows.map(d => d.id)
    const users = await prisma.user.findMany({
      where: { department_id: { in: deptIds }, is_active: true },
      select: { id: true },
    })
    userIds = users.map(u => u.id)
    scope = `dept:${depts.join(',')}`
  } else {
    const users = await prisma.user.findMany({
      where: { is_active: true },
      select: { id: true },
    })
    userIds = users.map(u => u.id)
    scope = 'everyone'
  }

  if (userIds.length === 0) return { data: null, error: 'No users matched the recipient selection' }

  await prisma.notification.createMany({
    data: userIds.map(userId => ({
      recipient_id: userId,
      type: 'admin_message' as const,
      payload: { message, link },
    })),
  })

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'manual_notification',
      entity_type: 'notification',
      new_value: { scope, count: userIds.length, message: message.slice(0, 100) },
    },
  })

  revalidatePath('/admin/notifications')
  return { data: { sent: userIds.length, scope }, error: null }
}
