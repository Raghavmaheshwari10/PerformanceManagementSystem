'use server'

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getStatusForEmployee } from '@/lib/cycle-helpers'
import { revalidatePath } from 'next/cache'
import type { ActionResult, CycleStatus } from '@/lib/types'

const COMMENTABLE_STATUSES: CycleStatus[] = ['self_review', 'manager_review']

export async function addKpiComment(
  kpiId: string,
  body: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  if (!user) return { data: null, error: 'Not authenticated' }

  const trimmed = body.trim()
  if (!trimmed) return { data: null, error: 'Comment cannot be empty' }
  if (trimmed.length > 2000) return { data: null, error: 'Comment too long (max 2000 characters)' }

  const kpi = await prisma.kpi.findUnique({
    where: { id: kpiId },
    select: {
      id: true,
      title: true,
      cycle_id: true,
      employee_id: true,
      manager_id: true,
    },
  })
  if (!kpi) return { data: null, error: 'KPI not found' }

  const isEmployee = user.id === kpi.employee_id
  const isManager = user.id === kpi.manager_id
  if (!isEmployee && !isManager) {
    return { data: null, error: 'Only the KPI employee or manager can comment' }
  }

  const status = await getStatusForEmployee(kpi.cycle_id, kpi.employee_id)
  if (!COMMENTABLE_STATUSES.includes(status)) {
    return { data: null, error: 'Comments are only allowed during self-review and manager review phases' }
  }

  const comment = await prisma.kpiComment.create({
    data: {
      kpi_id: kpiId,
      author_id: user.id,
      body: trimmed,
    },
    select: { id: true },
  })

  const recipientId = isEmployee ? kpi.manager_id : kpi.employee_id
  try {
    await prisma.notification.create({
      data: {
        recipient_id: recipientId,
        type: 'kpi_comment',
        payload: {
          kpi_id: kpi.id,
          kpi_title: kpi.title,
          commenter_name: user.full_name,
          cycle_id: kpi.cycle_id,
        },
      },
    })
  } catch {
    // Notification failure shouldn't block the comment
  }

  revalidatePath('/employee')
  revalidatePath('/manager')
  return { data: { id: comment.id }, error: null }
}

export interface KpiCommentData {
  id: string
  body: string
  created_at: Date
  author: {
    id: string
    full_name: string
    role: string
  }
}

export async function fetchKpiComments(kpiId: string): Promise<KpiCommentData[]> {
  const comments = await prisma.kpiComment.findMany({
    where: { kpi_id: kpiId },
    orderBy: { created_at: 'asc' },
    select: {
      id: true,
      body: true,
      created_at: true,
      author: {
        select: {
          id: true,
          full_name: true,
          role: true,
        },
      },
    },
  })
  return comments
}
