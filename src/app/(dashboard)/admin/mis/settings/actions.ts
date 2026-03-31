'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { checkMisHealth } from '@/lib/mis-api-client'
import type { ActionResult } from '@/lib/types'
import type { RatingTier } from '@prisma/client'

export async function saveMisConfig(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['admin'])

  const api_base_url = (formData.get('api_base_url') as string).trim()
  const api_key_raw = (formData.get('api_key') as string).trim()
  const fiscal_year = Number(formData.get('fiscal_year') || 2026)
  const auto_sync_enabled = formData.get('auto_sync_enabled') === 'true'
  const sync_cron = (formData.get('sync_cron') as string).trim() || '0 6 * * *'

  if (!api_base_url) return { data: null, error: 'API Base URL is required' }

  try {
    const existing = await prisma.misConfig.findFirst()

    // Only update API key if the value is not empty and not the masked placeholder
    const api_key_encrypted =
      api_key_raw && api_key_raw !== '********' ? api_key_raw : existing?.api_key_encrypted ?? ''

    if (existing) {
      await prisma.misConfig.update({
        where: { id: existing.id },
        data: { api_base_url, api_key_encrypted, fiscal_year, auto_sync_enabled, sync_cron, updated_at: new Date() },
      })
    } else {
      await prisma.misConfig.create({
        data: { api_base_url, api_key_encrypted, fiscal_year, auto_sync_enabled, sync_cron },
      })
    }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to save MIS config' }
  }

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'mis_config_saved',
      entity_type: 'mis_config',
      new_value: { api_base_url, fiscal_year, auto_sync_enabled, sync_cron },
    },
  })

  revalidatePath('/admin/mis/settings')
  return { data: null, error: null }
}

export async function saveDepartmentMapping(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole(['admin'])

  const raw = formData.get('department_mapping') as string
  let mapping: Record<string, string>
  try {
    mapping = JSON.parse(raw)
  } catch {
    return { data: null, error: 'Invalid mapping JSON' }
  }

  try {
    const existing = await prisma.misConfig.findFirst()
    if (!existing) return { data: null, error: 'Save API configuration first' }

    await prisma.misConfig.update({
      where: { id: existing.id },
      data: { department_mapping: mapping, updated_at: new Date() },
    })
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to save department mapping' }
  }

  revalidatePath('/admin/mis/settings')
  return { data: null, error: null }
}

export async function saveScoringConfig(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['admin'])

  const thresholds: { tier: RatingTier; min_score: number }[] = [
    { tier: 'FEE', min_score: Number(formData.get('fee_min') || 110) },
    { tier: 'EE', min_score: Number(formData.get('ee_min') || 95) },
    { tier: 'ME', min_score: Number(formData.get('me_min') || 80) },
    { tier: 'SME', min_score: Number(formData.get('sme_min') || 60) },
  ]

  try {
    for (const { tier, min_score } of thresholds) {
      await prisma.scoringConfig.upsert({
        where: { rating_tier: tier },
        update: { min_score },
        create: { rating_tier: tier, min_score },
      })
    }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to save scoring config' }
  }

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'scoring_config_saved',
      entity_type: 'scoring_config',
      new_value: { thresholds: thresholds.map(t => ({ tier: t.tier, min_score: t.min_score })) },
    },
  })

  revalidatePath('/admin/mis/settings')
  return { data: null, error: null }
}

export async function testMisConnection(): Promise<ActionResult<{ connected: boolean }>> {
  await requireRole(['admin'])
  try {
    const connected = await checkMisHealth()
    return { data: { connected }, error: null }
  } catch {
    return { data: { connected: false }, error: null }
  }
}
