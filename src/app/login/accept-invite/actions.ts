'use server'

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

interface AcceptInviteResult {
  error: string | null
}

export async function acceptInvite(token: string, password: string): Promise<AcceptInviteResult> {
  if (!token || !password) {
    return { error: 'Token and password are required' }
  }

  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters' }
  }

  const user = await prisma.user.findFirst({
    where: { invite_token: token },
    select: { id: true, invite_token_expires_at: true, is_active: true },
  })

  if (!user) {
    return { error: 'Invalid invite link. Contact your admin for a new invite.' }
  }

  if (!user.is_active) {
    return { error: 'Your account has been deactivated. Contact your admin.' }
  }

  if (user.invite_token_expires_at && user.invite_token_expires_at < new Date()) {
    return { error: 'This invite link has expired. Ask your admin to resend the invite.' }
  }

  const password_hash = await bcrypt.hash(password, 12)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password_hash,
      invite_token: null,
      invite_token_expires_at: null,
    },
  })

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'invite_accepted',
      entity_type: 'user',
      entity_id: user.id,
    },
  })

  return { error: null }
}
