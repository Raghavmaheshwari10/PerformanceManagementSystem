'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import type { RatingTier } from '@prisma/client'

export async function submitSelfReview(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['employee'])

  const cycleId = formData.get('cycle_id') as string

  // Deadline enforcement: cycle must be in self_review status and deadline not passed
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: { status: true, self_review_deadline: true },
  })

  if (!cycle || cycle.status !== 'self_review') {
    return { data: null, error: 'Cycle is not in self-review phase' }
  }
  if (cycle.self_review_deadline && new Date() > new Date(cycle.self_review_deadline)) {
    return { data: null, error: 'Self-review deadline has passed — contact your HRBP' }
  }

  const selfRating = formData.get('self_rating') as string
  const selfComments = formData.get('self_comments') as string

  const insertedReview = await prisma.review.upsert({
    where: { cycle_id_employee_id: { cycle_id: cycleId, employee_id: user.id } },
    update: {
      self_rating: (selfRating as RatingTier) || null,
      self_comments: selfComments,
      status: 'submitted',
      submitted_at: new Date(),
      updated_at: new Date(),
    },
    create: {
      cycle_id: cycleId,
      employee_id: user.id,
      self_rating: (selfRating as RatingTier) || null,
      self_comments: selfComments,
      status: 'submitted',
      submitted_at: new Date(),
    },
    select: { id: true },
  })

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'review_submitted',
      entity_type: 'review',
      entity_id: insertedReview.id,
      new_value: { cycle_id: cycleId, self_rating: selfRating },
    },
  })

  // Notify the manager that the employee submitted their self-review
  const employee = await prisma.user.findUnique({
    where: { id: user.id },
    select: { manager_id: true },
  })
  if (employee?.manager_id) {
    await prisma.notification.create({
      data: {
        recipient_id: employee.manager_id,
        type: 'review_submitted',
        payload: { cycle_id: cycleId, employee_id: user.id },
      },
    })
  }

  revalidatePath('/employee')
  return { data: null, error: null }
}

export async function saveDraftReview(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['employee'])

  const cycleId = formData.get('cycle_id') as string
  const selfRating = formData.get('self_rating') as string

  await prisma.review.upsert({
    where: { cycle_id_employee_id: { cycle_id: cycleId, employee_id: user.id } },
    update: {
      self_rating: (selfRating as RatingTier) || null,
      self_comments: formData.get('self_comments') as string,
      status: 'draft',
      updated_at: new Date(),
    },
    create: {
      cycle_id: cycleId,
      employee_id: user.id,
      self_rating: (selfRating as RatingTier) || null,
      self_comments: formData.get('self_comments') as string,
      status: 'draft',
    },
  })

  revalidatePath('/employee')
  return { data: null, error: null }
}
