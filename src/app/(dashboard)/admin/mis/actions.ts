'use server'

import { requireRole } from '@/lib/auth'
import { syncTargets, syncActuals } from '@/lib/mis-sync'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function triggerSync(): Promise<ActionResult> {
  const user = await requireRole(['admin'])

  try {
    const config = await prisma.misConfig.findFirst()
    const fiscalYear = config?.fiscal_year ?? new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1

    const targetsResult = await syncTargets(fiscalYear, user.id)
    const actualsResult = await syncActuals(fiscalYear, currentMonth, user.id)

    revalidatePath('/admin/mis')
    return {
      data: null,
      error: null,
    }
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : 'Sync failed',
    }
  }
}
