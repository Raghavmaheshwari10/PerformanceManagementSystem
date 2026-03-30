'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function saveEmailTemplate(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireRole(['admin'])

  const notificationType = (formData.get('notification_type') as string)?.trim()
  const subject = (formData.get('subject') as string)?.trim()
  const htmlBody = (formData.get('html_body') as string)?.trim()

  if (!notificationType) return { data: null, error: 'Notification type is required' }
  if (!subject) return { data: null, error: 'Subject is required' }
  if (!htmlBody) return { data: null, error: 'HTML body is required' }

  await prisma.emailTemplate.upsert({
    where: { notification_type: notificationType },
    create: {
      notification_type: notificationType,
      subject,
      html_body: htmlBody,
      updated_by: user.id,
    },
    update: {
      subject,
      html_body: htmlBody,
      updated_by: user.id,
      updated_at: new Date(),
    },
  })

  revalidatePath('/admin/email-templates')
  return { data: null, error: null }
}

export async function deleteEmailTemplate(
  notificationType: string
): Promise<ActionResult> {
  await requireRole(['admin'])

  await prisma.emailTemplate.delete({
    where: { notification_type: notificationType },
  }).catch(() => {})

  revalidatePath('/admin/email-templates')
  return { data: null, error: null }
}
