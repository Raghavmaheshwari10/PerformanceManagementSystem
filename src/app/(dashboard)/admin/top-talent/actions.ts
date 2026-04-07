'use server'

import { prisma } from '@/lib/prisma'
import { requireRole, getCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import { z } from 'zod'
import { saveTopTalentConfig as saveConfig, fetchTopTalentPool } from '@/lib/db/top-talent'
import logger from '@/lib/logger'

// ─── Zod Schema ────────────────────────────────────────────────────────

const configSchema = z.object({
  ratingTiers: z.array(z.enum(['FEE', 'EE', 'ME', 'SME', 'BE'])).min(1, 'Select at least one rating tier'),
  minCycles: z.coerce.number().int().min(1).max(10),
  scoreThreshold: z.coerce.number().int().min(0).max(100),
  misThreshold: z.coerce.number().int().min(0).max(100),
})

// ─── Save Top Talent Config ────────────────────────────────────────────

export async function saveTopTalentConfig(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireRole(['admin'])

  const ratingTiers = formData.getAll('rating_tiers') as string[]
  const minCycles = formData.get('min_cycles') as string
  const scoreThreshold = formData.get('score_threshold') as string
  const misThreshold = formData.get('mis_threshold') as string

  const parsed = configSchema.safeParse({
    ratingTiers,
    minCycles,
    scoreThreshold,
    misThreshold,
  })

  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0].message }
  }

  try {
    await saveConfig({ ...parsed.data, updatedBy: user.id })

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'top_talent_config_updated',
        entity_type: 'top_talent_config',
        new_value: parsed.data,
      },
    })
  } catch (e) {
    logger.error('saveTopTalentConfig', 'Failed to save config', undefined, e)
    return { data: null, error: e instanceof Error ? e.message : 'Failed to save config' }
  }

  revalidatePath('/admin/top-talent')
  revalidatePath('/hrbp/top-talent')
  revalidatePath('/manager/top-talent')
  return { data: null, error: null }
}

// ─── Export Top Talent CSV ─────────────────────────────────────────────

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function exportTopTalentCsv(
  cycleId?: string
): Promise<ActionResult<string>> {
  await requireRole(['admin', 'hrbp'])

  try {
    const pool = await fetchTopTalentPool({ cycleId })

    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
      { key: 'finalRating', label: 'Final Rating' },
      { key: 'compositeScore', label: 'Composite Score' },
      { key: 'misScore', label: 'MIS Score' },
      { key: 'goalCompletion', label: 'Goal Completion %' },
      { key: 'peerReviewAvg', label: 'Peer Review Avg' },
      { key: 'feedbackCount', label: 'Feedback Count' },
      { key: 'trend', label: 'Trend' },
      { key: 'consecutiveHighCycles', label: 'Consecutive High Cycles' },
    ]

    const header = columns.map(c => escapeCsvField(c.label)).join(',')
    const body = pool
      .map(row =>
        columns
          .map(c => {
            const val = row[c.key as keyof typeof row]
            return escapeCsvField(val == null ? '' : String(val))
          })
          .join(',')
      )
      .join('\n')

    const csvString = `${header}\n${body}`
    return { data: csvString, error: null }
  } catch (e) {
    logger.error('exportTopTalentCsv', 'Failed to export CSV', undefined, e)
    return { data: null, error: e instanceof Error ? e.message : 'Failed to export top talent CSV' }
  }
}
