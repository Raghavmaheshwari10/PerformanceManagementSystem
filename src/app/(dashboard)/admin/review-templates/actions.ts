'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import type { AnswerType } from '@prisma/client'

export async function createReviewTemplate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['admin', 'hrbp'])
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  if (!name) return { data: null, error: 'Name required' }

  await prisma.reviewTemplate.create({
    data: { name, description, created_by: user.id },
  })
  revalidatePath('/admin/review-templates')
  return { data: null, error: null }
}

export async function addTemplateQuestion(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole(['admin', 'hrbp'])
  const templateId = formData.get('template_id') as string
  const questionText = (formData.get('question_text') as string)?.trim()
  const answerType = (formData.get('answer_type') as AnswerType) || 'rating'
  const competencyId = (formData.get('competency_id') as string) || null

  if (!questionText) return { data: null, error: 'Question text required' }

  const count = await prisma.reviewQuestion.count({ where: { template_id: templateId } })
  await prisma.reviewQuestion.create({
    data: {
      template_id: templateId,
      question_text: questionText,
      answer_type: answerType,
      competency_id: competencyId || null,
      order_index: count,
    },
  })
  revalidatePath('/admin/review-templates')
  return { data: null, error: null }
}

export async function deleteReviewTemplate(id: string): Promise<void> {
  await requireRole(['admin'])
  await prisma.reviewTemplate.delete({ where: { id } })
  revalidatePath('/admin/review-templates')
}
