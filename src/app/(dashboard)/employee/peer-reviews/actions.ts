'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import type { RatingTier } from '@prisma/client'

export async function requestPeerReview(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['employee', 'manager', 'hrbp'])

  const cycleId = formData.get('cycle_id') as string
  const peerUserId = formData.get('peer_user_id') as string

  if (!peerUserId) return { data: null, error: 'Please select a peer' }
  if (peerUserId === user.id) return { data: null, error: 'Cannot request review from yourself' }

  const existing = await prisma.peerReviewRequest.findUnique({
    where: { cycle_id_reviewee_id_peer_user_id: { cycle_id: cycleId, reviewee_id: user.id, peer_user_id: peerUserId } },
  })
  if (existing) return { data: null, error: 'Already requested this peer' }

  await prisma.peerReviewRequest.create({
    data: {
      cycle_id: cycleId,
      reviewee_id: user.id,
      peer_user_id: peerUserId,
      requested_by: user.id,
    },
  })

  revalidatePath('/employee/peer-reviews')
  return { data: null, error: null }
}

export async function submitPeerReview(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['employee', 'manager', 'hrbp'])

  const requestId = formData.get('request_id') as string
  const rating = (formData.get('peer_rating') as RatingTier) || null
  const comments = (formData.get('peer_comments') as string)?.trim() || null

  const req = await prisma.peerReviewRequest.findUnique({
    where: { id: requestId },
    select: { peer_user_id: true, status: true },
  })
  if (!req || req.peer_user_id !== user.id) return { data: null, error: 'Request not found or unauthorized' }
  if (req.status === 'submitted') return { data: null, error: 'Already submitted' }

  await prisma.peerReviewRequest.update({
    where: { id: requestId },
    data: { status: 'submitted', peer_rating: rating, peer_comments: comments, updated_at: new Date() },
  })

  revalidatePath('/employee/peer-reviews')
  return { data: null, error: null }
}
