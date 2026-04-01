'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { getStatusForEmployee } from '@/lib/cycle-helpers'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import type { RatingTier } from '@prisma/client'

/** Extract per-KPI ratings and comments from form data */
function extractKpiRatings(formData: FormData): Array<{ kpiId: string; rating: string | null; comments: string | null; achievement: number | null }> {
  const entries: Array<{ kpiId: string; rating: string | null; comments: string | null; achievement: number | null }> = []
  const seenKpiIds = new Set<string>()

  for (const [key, value] of formData.entries()) {
    if (key.startsWith('kpi_rating_')) {
      const kpiId = key.replace('kpi_rating_', '')
      seenKpiIds.add(kpiId)
      const comments = (formData.get(`kpi_comments_${kpiId}`) as string)?.trim() || null
      const rawAchievement = formData.get(`kpi_achievement_${kpiId}`) as string
      const achievement = rawAchievement ? Number(rawAchievement) : null
      entries.push({ kpiId, rating: String(value) || null, comments, achievement })
    }
  }

  // Also pick up kpi_comments/achievement for KPIs that don't have a rating yet
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('kpi_comments_') && !key.startsWith('kpi_comments_undefined')) {
      const kpiId = key.replace('kpi_comments_', '')
      if (!seenKpiIds.has(kpiId)) {
        const rawAchievement = formData.get(`kpi_achievement_${kpiId}`) as string
        const achievement = rawAchievement ? Number(rawAchievement) : null
        entries.push({ kpiId, rating: null, comments: String(value)?.trim() || null, achievement })
      }
    }
    // Pick up achievement-only entries (no rating, no comments)
    if (key.startsWith('kpi_achievement_') && !seenKpiIds.has(key.replace('kpi_achievement_', ''))) {
      const kpiId = key.replace('kpi_achievement_', '')
      if (!seenKpiIds.has(kpiId)) {
        seenKpiIds.add(kpiId)
        const rawAchievement = String(value)
        const achievement = rawAchievement ? Number(rawAchievement) : null
        const comments = (formData.get(`kpi_comments_${kpiId}`) as string)?.trim() || null
        entries.push({ kpiId, rating: null, comments, achievement })
      }
    }
  }

  return entries
}

/** Save per-KPI self-ratings and achievement to the kpis table */
async function saveKpiRatings(formData: FormData, cycleId: string, employeeId: string) {
  const kpiRatings = extractKpiRatings(formData)
  if (kpiRatings.length === 0) return

  await Promise.all(
    kpiRatings.map(({ kpiId, rating, comments, achievement }) =>
      prisma.kpi.updateMany({
        where: { id: kpiId, cycle_id: cycleId, employee_id: employeeId },
        data: {
          self_rating: (rating as RatingTier) || null,
          self_comments: comments,
          achievement,
          updated_at: new Date(),
        },
      })
    )
  )
}

export async function submitSelfReview(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['employee'])

  const cycleId = formData.get('cycle_id') as string

  // Deadline enforcement: employee's resolved status must be self_review and deadline not passed
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: { status: true, self_review_deadline: true },
  })

  if (!cycle) {
    return { data: null, error: 'Cycle not found' }
  }
  const resolvedStatus = await getStatusForEmployee(cycleId, user.id)
  if (resolvedStatus !== 'self_review') {
    return { data: null, error: 'Cycle is not in self-review phase' }
  }
  if (cycle.self_review_deadline && new Date() > new Date(cycle.self_review_deadline)) {
    return { data: null, error: 'Self-review deadline has passed — contact your HRBP' }
  }

  // Prevent re-submission: only allow if review doesn't exist or is still a draft
  const existingReview = await prisma.review.findUnique({
    where: { cycle_id_employee_id: { cycle_id: cycleId, employee_id: user.id } },
    select: { status: true },
  })
  if (existingReview?.status === 'submitted') {
    return { data: null, error: 'Self-review has already been submitted. You cannot submit again.' }
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

  // Save per-KPI ratings
  await saveKpiRatings(formData, cycleId, user.id)

  // Save competency assessment responses
  const responseEntries: Array<{ question_id: string; rating_value: number | null; text_value: string | null }> = []
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('response_') && !key.startsWith('response_text_')) {
      const questionId = key.replace('response_', '')
      const ratingValue = value ? parseInt(String(value), 10) : null
      const textValue = (formData.get(`response_text_${questionId}`) as string) || null
      responseEntries.push({ question_id: questionId, rating_value: ratingValue, text_value: textValue })
    } else if (key.startsWith('response_text_') && !formData.has(`response_${key.replace('response_text_', '')}`)) {
      // Text-only questions (answer_type = 'text') that have no rating field
      const questionId = key.replace('response_text_', '')
      const textValue = String(value) || null
      responseEntries.push({ question_id: questionId, rating_value: null, text_value: textValue })
    }
  }

  if (responseEntries.length > 0) {
    // Delete existing responses for this review + respondent, then re-create
    await prisma.reviewResponse.deleteMany({
      where: { review_id: insertedReview.id, respondent_id: user.id },
    })
    await prisma.reviewResponse.createMany({
      data: responseEntries.map(entry => ({
        review_id: insertedReview.id,
        question_id: entry.question_id,
        respondent_id: user.id,
        rating_value: entry.rating_value,
        text_value: entry.text_value,
      })),
    })
  }

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

  // Prevent saving draft after submission
  const existingReview = await prisma.review.findUnique({
    where: { cycle_id_employee_id: { cycle_id: cycleId, employee_id: user.id } },
    select: { status: true },
  })
  if (existingReview?.status === 'submitted') {
    return { data: null, error: 'Self-review has already been submitted. Cannot save as draft.' }
  }

  const selfRating = formData.get('self_rating') as string

  const draftReview = await prisma.review.upsert({
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
    select: { id: true },
  })

  // Save per-KPI ratings
  await saveKpiRatings(formData, cycleId, user.id)

  // Save competency assessment responses as draft too
  const responseEntries: Array<{ question_id: string; rating_value: number | null; text_value: string | null }> = []
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('response_') && !key.startsWith('response_text_')) {
      const questionId = key.replace('response_', '')
      const ratingValue = value ? parseInt(String(value), 10) : null
      const textValue = (formData.get(`response_text_${questionId}`) as string) || null
      responseEntries.push({ question_id: questionId, rating_value: ratingValue, text_value: textValue })
    } else if (key.startsWith('response_text_') && !formData.has(`response_${key.replace('response_text_', '')}`)) {
      const questionId = key.replace('response_text_', '')
      const textValue = String(value) || null
      responseEntries.push({ question_id: questionId, rating_value: null, text_value: textValue })
    }
  }

  if (responseEntries.length > 0) {
    await prisma.reviewResponse.deleteMany({
      where: { review_id: draftReview.id, respondent_id: user.id },
    })
    await prisma.reviewResponse.createMany({
      data: responseEntries.map(entry => ({
        review_id: draftReview.id,
        question_id: entry.question_id,
        respondent_id: user.id,
        rating_value: entry.rating_value,
        text_value: entry.text_value,
      })),
    })
  }

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'review_draft_saved',
      entity_type: 'review',
      entity_id: draftReview.id,
      new_value: { cycle_id: cycleId, self_rating: selfRating },
    },
  })

  revalidatePath('/employee')
  return { data: null, error: null }
}
