'use server'

import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { bulkUpsertMisActuals } from '@/lib/db/aop'
import { updateKpiActualsFromMis } from '@/lib/aop-kpi-sync'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

const VALID_METRICS = ['delivered_revenue', 'gross_margin', 'gmv'] as const
const VALID_MONTHS = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'] as const

type UploadResult = { uploaded: number; failed: number; errors: string[] }

/**
 * Parse a single CSV value, handling quoted fields with commas inside.
 */
function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  values.push(current.trim())
  return values
}

export async function uploadMisActuals(
  _prev: ActionResult<UploadResult>,
  formData: FormData,
): Promise<ActionResult<UploadResult>> {
  const user = await requireRole(['admin'])

  const csvText = formData.get('csv') as string
  if (!csvText?.trim()) return { data: null, error: 'No CSV data provided' }

  const lines = csvText.trim().split(/\r?\n/)
  if (lines.length < 2) return { data: null, error: 'CSV must have a header row and at least one data row' }

  // Validate header
  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/^"|"$/g, ''))
  const required = ['employee_email', 'metric', 'month', 'fy', 'actual_value']
  for (const r of required) {
    if (!headers.includes(r)) {
      return { data: null, error: `Missing required column: ${r}` }
    }
  }

  const colIdx = Object.fromEntries(required.map(r => [r, headers.indexOf(r)]))

  let uploaded = 0
  let failed = 0
  const errors: string[] = []

  // Collect upserts grouped by employee_aop_id so we can batch and sync KPIs
  const upserts: { employee_aop_id: string; month: string; actual_value: number; uploaded_by: string }[] = []
  const affectedAopIds = new Set<string>()

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue // skip blank lines

    const values = parseCsvLine(line)
    const rowNum = i + 1

    const email = values[colIdx.employee_email]?.toLowerCase()
    const metric = values[colIdx.metric]?.toLowerCase()
    const month = values[colIdx.month]?.toLowerCase()
    const fy = values[colIdx.fy]?.trim()
    const actualStr = values[colIdx.actual_value]

    // Validate fields
    if (!email) {
      failed++
      errors.push(`Row ${rowNum}: missing employee_email`)
      continue
    }
    if (!VALID_METRICS.includes(metric as (typeof VALID_METRICS)[number])) {
      failed++
      errors.push(`Row ${rowNum}: invalid metric "${metric}" (must be one of: ${VALID_METRICS.join(', ')})`)
      continue
    }
    if (!VALID_MONTHS.includes(month as (typeof VALID_MONTHS)[number])) {
      failed++
      errors.push(`Row ${rowNum}: invalid month "${month}" (must be one of: ${VALID_MONTHS.join(', ')})`)
      continue
    }
    if (!fy) {
      failed++
      errors.push(`Row ${rowNum}: missing fiscal year (fy)`)
      continue
    }
    const actualValue = Number(actualStr)
    if (isNaN(actualValue)) {
      failed++
      errors.push(`Row ${rowNum}: actual_value must be a number, got "${actualStr}"`)
      continue
    }

    // Find user by email
    const employee = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    })
    if (!employee) {
      failed++
      errors.push(`Row ${rowNum}: employee not found (${email})`)
      continue
    }

    // Find EmployeeAop via OrgAop (fiscal_year + metric) → DepartmentAop → EmployeeAop (employee_id)
    const employeeAop = await prisma.employeeAop.findFirst({
      where: {
        employee_id: employee.id,
        department_aop: {
          org_aop: {
            fiscal_year: fy,
            metric: metric as (typeof VALID_METRICS)[number],
          },
        },
      },
      select: { id: true },
    })
    if (!employeeAop) {
      failed++
      errors.push(`Row ${rowNum}: no AOP target found for ${email} / ${metric} / ${fy}`)
      continue
    }

    upserts.push({
      employee_aop_id: employeeAop.id,
      month,
      actual_value: actualValue,
      uploaded_by: user.id,
    })
    affectedAopIds.add(employeeAop.id)
  }

  // Bulk upsert all valid rows
  if (upserts.length > 0) {
    try {
      await bulkUpsertMisActuals(upserts)
      uploaded = upserts.length
    } catch (e) {
      return { data: null, error: `Bulk upsert failed: ${e instanceof Error ? e.message : 'unknown error'}` }
    }

    // Sync KPI actuals for each affected EmployeeAop
    for (const aopId of affectedAopIds) {
      try {
        await updateKpiActualsFromMis(aopId)
      } catch {
        // Non-fatal: KPI sync failure shouldn't block the upload result
      }
    }
  }

  // Notify affected department heads about the MIS upload
  if (affectedAopIds.size > 0 && upserts.length > 0) {
    try {
      // Get the month from the first successfully uploaded row
      const uploadedMonth = upserts[0]?.month ?? 'the latest period'

      // Find the department_ids for all affected EmployeeAops
      const affectedEmployeeAops = await prisma.employeeAop.findMany({
        where: { id: { in: [...affectedAopIds] } },
        select: { department_aop: { select: { department_id: true } } },
      })
      const deptIds = [...new Set(affectedEmployeeAops.map((ea) => ea.department_aop.department_id).filter(Boolean))] as string[]

      if (deptIds.length > 0) {
        const deptHeads = await prisma.user.findMany({
          where: { role: 'department_head', department_id: { in: deptIds }, is_active: true },
          select: { id: true },
        })
        if (deptHeads.length > 0) {
          await prisma.notification.createMany({
            data: deptHeads.map((dh) => ({
              recipient_id: dh.id,
              type: 'aop_mis_uploaded' as const,
              payload: {
                title: 'MIS Actuals Updated',
                body: `New MIS actuals have been uploaded for your department for ${uploadedMonth}. Your team's KPI achievements have been updated.`,
                month: uploadedMonth,
              },
            })),
          })
        }
      }
    } catch {
      // Non-fatal: notification failure should not block upload result
    }
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'aop_mis_actuals_uploaded',
      entity_type: 'employee_mis_actual',
      new_value: { uploaded, failed },
    },
  })

  revalidatePath('/admin/aop')

  return {
    data: { uploaded, failed, errors: errors.slice(0, 20) },
    error: null,
  }
}

export async function downloadMisTemplate(): Promise<string> {
  return 'employee_email,metric,month,fy,actual_value\nraghav@emb.global,delivered_revenue,apr,FY26,8500000'
}
