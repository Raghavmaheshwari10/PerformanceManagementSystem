'use server'

import { requireRole } from '@/lib/auth'
import { syncTargets, syncActuals } from '@/lib/mis-sync'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

// ─── API Sync (existing) ────────────────────────────────────────────

export async function triggerSync(): Promise<ActionResult> {
  const user = await requireRole(['admin'])

  try {
    const config = await prisma.misConfig.findFirst()
    const fiscalYear = config?.fiscal_year ?? new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1

    const targetsResult = await syncTargets(fiscalYear, user.id)
    const actualsResult = await syncActuals(fiscalYear, currentMonth, user.id)

    revalidatePath('/admin/mis')
    return { data: null, error: null }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Sync failed' }
  }
}

// ─── Manual Target CRUD ─────────────────────────────────────────────

export async function createTarget(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['admin'])

  const metric_name = (formData.get('metric_name') as string)?.trim()
  const category = (formData.get('category') as string) || 'financial'
  const level = (formData.get('level') as string) || 'individual'
  const annual_target = Number(formData.get('annual_target'))
  const unit = (formData.get('unit') as string)?.trim() || 'number'
  const fiscal_year = Number(formData.get('fiscal_year')) || new Date().getFullYear()
  const department_id = (formData.get('department_id') as string) || null
  const employee_id = (formData.get('employee_id') as string) || null
  const red_threshold = Number(formData.get('red_threshold')) || 80
  const amber_threshold = Number(formData.get('amber_threshold')) || 95

  if (!metric_name) return { data: null, error: 'Metric name is required' }
  if (!annual_target || annual_target <= 0) return { data: null, error: 'Annual target must be > 0' }
  if (level === 'individual' && !employee_id) return { data: null, error: 'Employee is required for individual targets' }
  if (level === 'department' && !department_id) return { data: null, error: 'Department is required for department targets' }

  try {
    const target = await prisma.aopTarget.create({
      data: {
        external_id: `manual-${crypto.randomUUID()}`,
        fiscal_year,
        level,
        department_id: department_id || null,
        employee_id: employee_id || null,
        metric_name,
        category,
        annual_target,
        unit,
        red_threshold,
        amber_threshold,
      },
    })

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'aop_target_created',
        entity_type: 'aop_target',
        entity_id: target.id,
        new_value: { metric_name, annual_target, level, category },
      },
    })
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to create target' }
  }

  revalidatePath('/admin/mis')
  return { data: null, error: null }
}

export async function updateTarget(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['admin'])

  const targetId = formData.get('target_id') as string
  if (!targetId) return { data: null, error: 'Target ID required' }

  const metric_name = (formData.get('metric_name') as string)?.trim()
  const category = (formData.get('category') as string) || 'financial'
  const annual_target = Number(formData.get('annual_target'))
  const unit = (formData.get('unit') as string)?.trim() || 'number'
  const department_id = (formData.get('department_id') as string) || null
  const employee_id = (formData.get('employee_id') as string) || null
  const red_threshold = Number(formData.get('red_threshold')) || 80
  const amber_threshold = Number(formData.get('amber_threshold')) || 95

  if (!metric_name) return { data: null, error: 'Metric name is required' }
  if (!annual_target || annual_target <= 0) return { data: null, error: 'Annual target must be > 0' }

  try {
    await prisma.aopTarget.update({
      where: { id: targetId },
      data: {
        metric_name,
        category,
        annual_target,
        unit,
        department_id: department_id || null,
        employee_id: employee_id || null,
        red_threshold,
        amber_threshold,
      },
    })

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'aop_target_updated',
        entity_type: 'aop_target',
        entity_id: targetId,
        new_value: { metric_name, annual_target, category },
      },
    })
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to update target' }
  }

  revalidatePath('/admin/mis')
  return { data: null, error: null }
}

export async function deleteTarget(targetId: string): Promise<ActionResult> {
  const user = await requireRole(['admin'])

  try {
    await prisma.aopTarget.delete({ where: { id: targetId } })

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'aop_target_deleted',
        entity_type: 'aop_target',
        entity_id: targetId,
      },
    })
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to delete target' }
  }

  revalidatePath('/admin/mis')
  return { data: null, error: null }
}

// ─── Monthly Actuals Entry ──────────────────────────────────────────

export async function upsertActual(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['admin'])

  const aop_target_id = formData.get('aop_target_id') as string
  const year = Number(formData.get('year'))
  const month = Number(formData.get('month'))
  const actual_value = Number(formData.get('actual_value'))
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!aop_target_id) return { data: null, error: 'Target ID required' }
  if (!year || !month) return { data: null, error: 'Year and month required' }
  if (month < 1 || month > 12) return { data: null, error: 'Month must be 1-12' }
  if (isNaN(actual_value)) return { data: null, error: 'Actual value is required' }

  try {
    await prisma.misActual.upsert({
      where: {
        uq_mis_actual_target_month: { aop_target_id, year, month },
      },
      create: { aop_target_id, year, month, actual_value, notes, synced_at: new Date() },
      update: { actual_value, notes, synced_at: new Date() },
    })

    // Recalculate YTD actual from all monthly actuals for this target+year
    const allActuals = await prisma.misActual.findMany({
      where: { aop_target_id, year },
      select: { actual_value: true },
    })
    const ytdTotal = allActuals.reduce((s, a) => s + Number(a.actual_value), 0)

    await prisma.aopTarget.update({
      where: { id: aop_target_id },
      data: { ytd_actual: ytdTotal },
    })

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'mis_actual_entered',
        entity_type: 'mis_actual',
        new_value: { aop_target_id, year, month, actual_value },
      },
    })
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to save actual' }
  }

  revalidatePath('/admin/mis')
  return { data: null, error: null }
}

// ─── CSV Bulk Import ────────────────────────────────────────────────

export async function importTargetsCsv(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireRole(['admin'])

  const csvText = formData.get('csv_data') as string
  if (!csvText?.trim()) return { data: null, error: 'No CSV data provided' }

  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return { data: null, error: 'CSV must have a header row and at least one data row' }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const required = ['metric_name', 'annual_target', 'level']
  for (const r of required) {
    if (!headers.includes(r)) return { data: null, error: `Missing required column: ${r}` }
  }

  const fiscal_year = Number(formData.get('fiscal_year')) || new Date().getFullYear()
  let created = 0
  let failed = 0
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    if (values.length < headers.length) {
      failed++
      errors.push(`Row ${i + 1}: insufficient columns`)
      continue
    }

    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = values[idx] })

    const metric_name = row.metric_name
    const annual_target = Number(row.annual_target)
    const level = row.level || 'individual'
    const category = row.category || 'financial'
    const unit = row.unit || 'number'
    const employee_email = row.employee_email || ''
    const department_name = row.department || ''

    if (!metric_name || isNaN(annual_target) || annual_target <= 0) {
      failed++
      errors.push(`Row ${i + 1}: invalid metric_name or annual_target`)
      continue
    }

    try {
      // Resolve employee by email
      let employee_id: string | null = null
      if (employee_email) {
        const emp = await prisma.user.findFirst({ where: { email: employee_email }, select: { id: true } })
        employee_id = emp?.id ?? null
        if (!employee_id) {
          failed++
          errors.push(`Row ${i + 1}: employee not found (${employee_email})`)
          continue
        }
      }

      // Resolve department by name
      let department_id: string | null = null
      if (department_name) {
        const dept = await prisma.department.findFirst({
          where: { name: { equals: department_name, mode: 'insensitive' } },
          select: { id: true },
        })
        department_id = dept?.id ?? null
      }

      await prisma.aopTarget.create({
        data: {
          external_id: `csv-${crypto.randomUUID()}`,
          fiscal_year,
          level,
          department_id,
          employee_id,
          metric_name,
          category,
          annual_target,
          unit,
          red_threshold: Number(row.red_threshold) || 80,
          amber_threshold: Number(row.amber_threshold) || 95,
        },
      })
      created++
    } catch (e) {
      failed++
      errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : 'unknown error'}`)
    }
  }

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'aop_targets_csv_imported',
      entity_type: 'aop_target',
      new_value: { created, failed, fiscal_year },
    },
  })

  revalidatePath('/admin/mis')

  if (failed > 0) {
    return { data: null, error: `Imported ${created}, failed ${failed}. Errors: ${errors.slice(0, 5).join('; ')}` }
  }
  return { data: null, error: null }
}
