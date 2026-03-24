'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

export async function snoozeNotification(id: string, until: string) {
  const session = await auth()
  if (!session?.user?.id) return

  await prisma.notification.update({
    where: { id, recipient_id: session.user.id },
    data: { snoozed_until: new Date(until) },
  })
  revalidatePath('/', 'layout')
}

export async function dismissNotification(id: string) {
  const session = await auth()
  if (!session?.user?.id) return

  await prisma.notification.update({
    where: { id, recipient_id: session.user.id },
    data: { dismissed_at: new Date() },
  })
  revalidatePath('/', 'layout')
}

export async function markAllNotificationsRead() {
  const session = await auth()
  if (!session?.user?.id) return

  // Mark unread (pending) notifications as read (sent) without hiding them
  await prisma.notification.updateMany({
    where: { recipient_id: session.user.id, status: 'pending' },
    data: { status: 'sent' },
  })
  revalidatePath('/', 'layout')
}
