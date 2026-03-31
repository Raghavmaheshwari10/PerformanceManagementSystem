'use server'

import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import type { ActionResult } from '@/lib/types'

export async function resetPassword(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const token = formData.get('token') as string
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (!token) return { data: null, error: 'Invalid reset link' }
  if (!password || password.length < 8) return { data: null, error: 'Password must be at least 8 characters' }
  if (password !== confirm) return { data: null, error: 'Passwords do not match' }

  const user = await prisma.user.findFirst({
    where: {
      reset_token: token,
      reset_token_expires_at: { gt: new Date() },
    },
    select: { id: true },
  })

  if (!user) return { data: null, error: 'Reset link is invalid or has expired' }

  const password_hash = await hash(password, 12)

  await prisma.user.update({
    where: { id: user.id },
    data: { password_hash, reset_token: null, reset_token_expires_at: null },
  })

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'password_reset',
      entity_type: 'user',
      entity_id: user.id,
    },
  })

  return { data: null, error: null }
}
