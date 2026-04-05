'use server'

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/** Mark the current user as onboarded in the DB — called once when they finish/skip any tour. */
export async function markUserOnboarded(): Promise<void> {
  const user = await getCurrentUser()
  if (user.onboarded_at) return  // Already marked — no-op
  await prisma.user.update({
    where: { id: user.id },
    data: { onboarded_at: new Date() },
  })
}
