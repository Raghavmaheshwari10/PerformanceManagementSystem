'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { notifyUsers } from '@/lib/email'
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

  const reviewee = await prisma.user.findUnique({ where: { id: user.id }, select: { full_name: true } })

  await prisma.peerReviewRequest.create({
    data: {
      cycle_id: cycleId,
      reviewee_id: user.id,
      peer_user_id: peerUserId,
      requested_by: user.id,
    },
  })

  // Notify the peer that a review has been requested
  notifyUsers([peerUserId], 'peer_review_requested', {
    requester_name: reviewee?.full_name ?? 'A colleague',
    reviewee_name: reviewee?.full_name ?? '',
  }).catch(console.error)

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
    select: { peer_user_id: true, reviewee_id: true, status: true },
  })
  if (!req || req.peer_user_id !== user.id) return { data: null, error: 'Request not found or unauthorized' }
  if (req.status === 'submitted') return { data: null, error: 'Already submitted' }
  if (req.status !== 'accepted') return { data: null, error: 'You must accept the review request before submitting' }

  await prisma.peerReviewRequest.update({
    where: { id: requestId },
    data: { status: 'submitted', peer_rating: rating, peer_comments: comments, updated_at: new Date() },
  })

  // Notify the reviewee that a peer review was submitted
  const peer = await prisma.user.findUnique({ where: { id: user.id }, select: { full_name: true } })
  notifyUsers([req.reviewee_id], 'peer_review_submitted', {
    peer_name: peer?.full_name ?? 'A peer',
  }).catch(console.error)

  revalidatePath('/employee/peer-reviews')
  return { data: null, error: null }
}

export async function acceptPeerReview(requestId: string): Promise<ActionResult> {
  const user = await requireRole(['employee', 'manager', 'hrbp'])

  const req = await prisma.peerReviewRequest.findUnique({
    where: { id: requestId },
    select: { peer_user_id: true, status: true },
  })
  if (!req || req.peer_user_id !== user.id) return { data: null, error: 'Request not found or unauthorized' }
  if (req.status !== 'requested') return { data: null, error: 'Can only accept a pending request' }

  await prisma.peerReviewRequest.update({
    where: { id: requestId },
    data: { status: 'accepted', updated_at: new Date() },
  })

  revalidatePath('/employee/peer-reviews')
  return { data: null, error: null }
}

export async function declinePeerReview(requestId: string): Promise<ActionResult> {
  const user = await requireRole(['employee', 'manager', 'hrbp'])

  const req = await prisma.peerReviewRequest.findUnique({
    where: { id: requestId },
    select: { peer_user_id: true, status: true },
  })
  if (!req || req.peer_user_id !== user.id) return { data: null, error: 'Request not found or unauthorized' }
  if (req.status !== 'requested') return { data: null, error: 'Can only decline a pending request' }

  await prisma.peerReviewRequest.update({
    where: { id: requestId },
    data: { status: 'declined', updated_at: new Date() },
  })

  revalidatePath('/employee/peer-reviews')
  return { data: null, error: null }
}
