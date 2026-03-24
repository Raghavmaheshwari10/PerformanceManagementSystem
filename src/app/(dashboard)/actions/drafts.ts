'use server'

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireRole } from '@/lib/auth'
import type { ActionResult } from '@/lib/types'

type DraftJson = Parameters<typeof prisma.draft.create>[0]['data']['form_data']

export async function saveDraft(
  entityType: string,
  entityId: string | null,
  formData: Record<string, unknown>
): Promise<ActionResult> {
  try {
    const user = await requireRole(['employee', 'manager', 'hrbp', 'admin'])
    const data = { form_data: formData as DraftJson, updated_at: new Date() }

    if (entityId !== null) {
      // Non-null entity_id: safe to use compound unique key upsert
      await prisma.draft.upsert({
        where: {
          user_id_entity_type_entity_id: {
            user_id: user.id,
            entity_type: entityType,
            entity_id: entityId,
          },
        },
        update: data,
        create: { user_id: user.id, entity_type: entityType, entity_id: entityId, ...data },
      })
    } else {
      // Null entity_id: DB unique constraint doesn't cover NULLs in PG, so use
      // findFirst + conditional write and handle the rare P2002 race gracefully.
      const existing = await prisma.draft.findFirst({
        where: { user_id: user.id, entity_type: entityType, entity_id: null },
      })
      if (existing) {
        await prisma.draft.update({ where: { id: existing.id }, data })
      } else {
        try {
          await prisma.draft.create({
            data: { user_id: user.id, entity_type: entityType, entity_id: null, ...data },
          })
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
            // Concurrent create won the race — update the row that now exists
            const race = await prisma.draft.findFirst({
              where: { user_id: user.id, entity_type: entityType, entity_id: null },
            })
            if (race) await prisma.draft.update({ where: { id: race.id }, data })
          } else { throw e }
        }
      }
    }

    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Save failed' }
  }
}

export async function loadDraft(
  entityType: string,
  entityId: string | null
): Promise<ActionResult<Record<string, unknown> | null>> {
  try {
    const user = await requireRole(['employee', 'manager', 'hrbp', 'admin'])

    const draft = await prisma.draft.findFirst({
      where: {
        user_id: user.id,
        entity_type: entityType,
        entity_id: entityId ?? null,
      },
    })
    return { data: draft ? (draft.form_data as Record<string, unknown>) : null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Load failed' }
  }
}

export async function clearDraft(
  entityType: string,
  entityId: string | null
): Promise<ActionResult> {
  try {
    const user = await requireRole(['employee', 'manager', 'hrbp', 'admin'])

    await prisma.draft.deleteMany({
      where: {
        user_id: user.id,
        entity_type: entityType,
        entity_id: entityId ?? null,
      },
    })

    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Clear failed' }
  }
}
