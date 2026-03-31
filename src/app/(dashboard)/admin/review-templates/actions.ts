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

  const template = await prisma.reviewTemplate.create({
    data: { name, description, created_by: user.id },
  })
  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'review_template_created',
      entity_type: 'review_template',
      entity_id: template.id,
      new_value: { name, description },
    },
  })
  revalidatePath('/admin/review-templates')
  return { data: null, error: null }
}

export async function addTemplateQuestion(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['admin', 'hrbp'])
  const templateId = formData.get('template_id') as string
  const questionText = (formData.get('question_text') as string)?.trim()
  const answerType = (formData.get('answer_type') as AnswerType) || 'rating'
  const competencyId = (formData.get('competency_id') as string) || null

  if (!questionText) return { data: null, error: 'Question text required' }

  const count = await prisma.reviewQuestion.count({ where: { template_id: templateId } })
  const question = await prisma.reviewQuestion.create({
    data: {
      template_id: templateId,
      question_text: questionText,
      answer_type: answerType,
      competency_id: competencyId || null,
      order_index: count,
    },
  })
  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'template_question_added',
      entity_type: 'review_question',
      entity_id: question.id,
      new_value: { template_id: templateId, question_text: questionText, answer_type: answerType },
    },
  })
  revalidatePath('/admin/review-templates')
  return { data: null, error: null }
}

export async function deleteReviewTemplate(id: string): Promise<void> {
  const user = await requireRole(['admin'])
  await prisma.reviewTemplate.delete({ where: { id } })
  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'review_template_deleted',
      entity_type: 'review_template',
      entity_id: id,
      new_value: {},
    },
  })
  revalidatePath('/admin/review-templates')
}
