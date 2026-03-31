'use server'

import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'
import { randomBytes } from 'crypto'
import type { ActionResult } from '@/lib/types'

export async function requestPasswordReset(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  if (!email) return { data: null, error: 'Email is required' }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, is_active: true },
  })

  // Always return success to prevent email enumeration
  if (!user || !user.is_active) return { data: null, error: null }

  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 3600_000) // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { reset_token: token, reset_token_expires_at: expires },
  })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? 'https://pms.emb.global'
  const resetUrl = `${baseUrl}/login/reset-password?token=${token}`

  try {
    await sendPasswordResetEmail(email, resetUrl)
  } catch (e) {
    console.error('Failed to send reset email:', e)
    // Don't expose email sending errors to the user
  }

  return { data: null, error: null }
}
