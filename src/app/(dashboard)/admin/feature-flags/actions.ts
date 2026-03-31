'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

export async function toggleFeatureFlag(key: string, value: boolean): Promise<ActionResult> {
  try {
    const user = await requireRole(['admin'])

    const existing = await prisma.featureFlagOverride.findFirst({
      where: { flag_key: key, scope: 'org', scope_id: null },
    })

    if (existing) {
      await prisma.featureFlagOverride.update({
        where: { id: existing.id },
        data: { value, updated_by: user.id, updated_at: new Date() },
      })
    } else {
      await prisma.featureFlagOverride.create({
        data: { flag_key: key, scope: 'org', scope_id: null, value, updated_by: user.id },
      })
    }

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'feature_flag_toggled',
        entity_type: 'feature_flag',
        entity_id: key,
        new_value: { flag_key: key, value },
      },
    })

    revalidatePath('/admin/feature-flags')
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to update feature flag' }
  }
}
