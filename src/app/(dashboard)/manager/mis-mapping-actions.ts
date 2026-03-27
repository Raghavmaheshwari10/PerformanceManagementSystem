'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function linkKpiToMis(
  kpiId: string,
  aopTargetId: string,
  formula: string,
): Promise<ActionResult> {
  await requireRole(['manager'])

  // Validate formula
  const validFormulas = ['linear', 'capped', 'inverse']
  if (!validFormulas.includes(formula)) {
    return { data: null, error: 'Invalid score formula' }
  }

  // Verify the KPI exists
  const kpi = await prisma.kpi.findUnique({ where: { id: kpiId }, select: { employee_id: true } })
  if (!kpi) return { data: null, error: 'KPI not found' }

  // Verify the AOP target exists
  const target = await prisma.aopTarget.findUnique({ where: { id: aopTargetId }, select: { id: true } })
  if (!target) return { data: null, error: 'AOP target not found' }

  await prisma.kpiMisMapping.upsert({
    where: { uq_kpi_mis_mapping: { kpi_id: kpiId, aop_target_id: aopTargetId } },
    update: { score_formula: formula },
    create: {
      kpi_id: kpiId,
      aop_target_id: aopTargetId,
      score_formula: formula,
    },
  })

  revalidatePath(`/manager/${kpi.employee_id}/kpis`)
  return { data: null, error: null }
}

export async function unlinkKpiFromMis(mappingId: string): Promise<ActionResult> {
  await requireRole(['manager'])

  const mapping = await prisma.kpiMisMapping.findUnique({
    where: { id: mappingId },
    select: { kpi: { select: { employee_id: true } } },
  })
  if (!mapping) return { data: null, error: 'Mapping not found' }

  await prisma.kpiMisMapping.delete({ where: { id: mappingId } })

  revalidatePath(`/manager/${mapping.kpi.employee_id}/kpis`)
  return { data: null, error: null }
}

export async function getAvailableTargets(
  employeeId: string,
): Promise<{ id: string; metric_name: string; category: string; annual_target: number; unit: string }[]> {
  await requireRole(['manager'])

  const targets = await prisma.aopTarget.findMany({
    where: { employee_id: employeeId },
    select: {
      id: true,
      metric_name: true,
      category: true,
      annual_target: true,
      unit: true,
    },
    orderBy: { metric_name: 'asc' },
  })

  return targets.map(t => ({
    id: t.id,
    metric_name: t.metric_name,
    category: t.category,
    annual_target: Number(t.annual_target),
    unit: t.unit,
  }))
}
