'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import type { FeedbackCategory, FeedbackVisibility } from '@prisma/client'

export async function sendFeedback(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['employee', 'manager', 'hrbp'])

  const to_user_id = formData.get('to_user_id') as string
  const category = formData.get('category') as FeedbackCategory
  const message = (formData.get('message') as string)?.trim()
  const visibility = (formData.get('visibility') as FeedbackVisibility) || 'recipient_and_manager'

  if (!to_user_id || !message) return { data: null, error: 'Recipient and message are required' }
  if (to_user_id === user.id) return { data: null, error: 'You cannot send feedback to yourself' }

  const recipient = await prisma.user.findUnique({ where: { id: to_user_id }, select: { id: true } })
  if (!recipient) return { data: null, error: 'Recipient not found' }

  const feedback = await prisma.feedback.create({
    data: {
      from_user_id: user.id,
      to_user_id,
      category,
      message,
      visibility,
    },
    select: { id: true },
  })

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'feedback_sent',
      entity_type: 'feedback',
      entity_id: feedback.id,
      new_value: { to_user_id, category, visibility },
    },
  })

  revalidatePath('/employee/feedback')
  return { data: null, error: null }
}
