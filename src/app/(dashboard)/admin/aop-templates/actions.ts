'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

const AOP_KRA_TITLE = 'AOP Targets'
const AOP_KPI_TITLES = ['Delivered Revenue', 'Gross Margin', 'New Sales (GMV)'] as const

export async function initAopTemplates(): Promise<ActionResult> {
  const user = await requireRole(['superadmin'])

  try {
    // 1. Find or create the KRA template "AOP Targets"
    let kraTemplate = await prisma.kraTemplate.findFirst({
      where: { title: AOP_KRA_TITLE, is_protected: true },
    })

    if (!kraTemplate) {
      kraTemplate = await prisma.kraTemplate.create({
        data: {
          title: AOP_KRA_TITLE,
          category: 'performance',
          is_protected: true,
          created_by: user.id,
        },
      })
    }

    // 2. Find or create each KPI template linked to the KRA template
    for (const title of AOP_KPI_TITLES) {
      const existing = await prisma.kpiTemplate.findFirst({
        where: { title, is_protected: true, kra_template_id: kraTemplate.id },
      })

      if (!existing) {
        await prisma.kpiTemplate.create({
          data: {
            title,
            kra_template_id: kraTemplate.id,
            unit: 'number',
            category: 'performance',
            is_protected: true,
            created_by: user.id,
          },
        })
      }
    }

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'aop_templates_initialized',
        entity_type: 'kra_template',
        entity_id: kraTemplate.id,
        new_value: { kra_title: AOP_KRA_TITLE, kpi_titles: AOP_KPI_TITLES },
      },
    })

    revalidatePath('/admin/aop-templates')
    return { data: { kraTemplateId: kraTemplate.id }, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to initialize AOP templates' }
  }
}
