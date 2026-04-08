'use server'

import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

// ─────────────────────────────────────────
// Save exchange rates (AED→INR, USD→INR) for a fiscal year
// ─────────────────────────────────────────

export async function saveExchangeRates(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(['admin'])

  const fiscal_year = (formData.get('fiscal_year') as string)?.trim()
  const aed_to_inr = parseFloat(formData.get('aed_to_inr') as string)
  const usd_to_inr = parseFloat(formData.get('usd_to_inr') as string)

  if (!fiscal_year) return { data: null, error: 'Fiscal year is required' }
  if (isNaN(aed_to_inr) || aed_to_inr <= 0)
    return { data: null, error: 'AED to INR rate must be a positive number' }
  if (isNaN(usd_to_inr) || usd_to_inr <= 0)
    return { data: null, error: 'USD to INR rate must be a positive number' }

  try {
    await prisma.$transaction([
      prisma.exchangeRate.upsert({
        where: {
          fiscal_year_from_currency_to_currency: {
            fiscal_year,
            from_currency: 'AED',
            to_currency: 'INR',
          },
        },
        create: {
          fiscal_year,
          from_currency: 'AED',
          to_currency: 'INR',
          rate: aed_to_inr,
          updated_by: user.id,
        },
        update: {
          rate: aed_to_inr,
          updated_by: user.id,
          updated_at: new Date(),
        },
      }),
      prisma.exchangeRate.upsert({
        where: {
          fiscal_year_from_currency_to_currency: {
            fiscal_year,
            from_currency: 'USD',
            to_currency: 'INR',
          },
        },
        create: {
          fiscal_year,
          from_currency: 'USD',
          to_currency: 'INR',
          rate: usd_to_inr,
          updated_by: user.id,
        },
        update: {
          rate: usd_to_inr,
          updated_by: user.id,
          updated_at: new Date(),
        },
      }),
    ])

    await prisma.auditLog.create({
      data: {
        changed_by: user.id,
        action: 'exchange_rates_updated',
        entity_type: 'exchange_rate',
        new_value: { fiscal_year, aed_to_inr, usd_to_inr },
      },
    })
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Failed to save exchange rates' }
  }

  revalidatePath('/admin/aop/salary')
  return { data: null, error: null }
}

// ─────────────────────────────────────────
// Upload salary CSV and update user CTC + currency
// ─────────────────────────────────────────

export async function uploadSalaryCsv(
  _prev: ActionResult<{ uploaded: number; failed: number; errors: string[] }>,
  formData: FormData,
): Promise<ActionResult<{ uploaded: number; failed: number; errors: string[] }>> {
  await requireRole(['admin'])

  const csvText = (formData.get('csv_text') as string)?.trim()
  const file = formData.get('csv_file') as File | null

  let rawCsv = ''
  if (file && file.size > 0) {
    rawCsv = await file.text()
  } else if (csvText) {
    rawCsv = csvText
  } else {
    return { data: null, error: 'No CSV data provided' }
  }

  const lines = rawCsv
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  // Skip header if it looks like one
  const firstLine = lines[0]?.toLowerCase() ?? ''
  const startIdx = firstLine.includes('email') || firstLine.includes('employee') ? 1 : 0

  const validCurrencies = ['INR', 'AED', 'USD']
  let uploaded = 0
  let failed = 0
  const errors: string[] = []

  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim())
    if (cols.length < 6) {
      errors.push(`Row ${i + 1}: Expected 6 columns, got ${cols.length}`)
      failed++
      continue
    }

    const [email, fixedStr, variableStr, retentionStr, onetimeStr, currency] = cols

    if (!email || !email.includes('@')) {
      errors.push(`Row ${i + 1}: Invalid email "${email}"`)
      failed++
      continue
    }

    const fixed_ctc = parseFloat(fixedStr)
    const annual_variable = parseFloat(variableStr)
    const retention_bonus = parseFloat(retentionStr)
    const onetime_bonus = parseFloat(onetimeStr)
    const cur = currency?.toUpperCase() ?? 'INR'

    if (!validCurrencies.includes(cur)) {
      errors.push(`Row ${i + 1}: Invalid currency "${currency}" (use INR, AED, or USD)`)
      failed++
      continue
    }

    if ([fixed_ctc, annual_variable, retention_bonus, onetime_bonus].some(isNaN)) {
      errors.push(`Row ${i + 1}: Invalid numeric value for ${email}`)
      failed++
      continue
    }

    try {
      const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
      if (!existingUser) {
        errors.push(`Row ${i + 1}: User not found: ${email}`)
        failed++
        continue
      }

      await prisma.user.update({
        where: { email: email.toLowerCase() },
        data: {
          fixed_ctc,
          annual_variable,
          retention_bonus,
          onetime_bonus,
          salary_currency: cur,
        },
      })
      uploaded++
    } catch (e) {
      errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : 'Update failed'} for ${email}`)
      failed++
    }
  }

  revalidatePath('/admin/aop/salary')
  return { data: { uploaded, failed, errors }, error: null }
}

// ─────────────────────────────────────────
// Get exchange rates for a fiscal year
// ─────────────────────────────────────────

export async function getExchangeRates(fiscalYear: string) {
  await requireRole(['admin'])

  const rates = await prisma.exchangeRate.findMany({
    where: { fiscal_year: fiscalYear },
    select: {
      id: true,
      fiscal_year: true,
      from_currency: true,
      to_currency: true,
      rate: true,
      updated_at: true,
    },
  })

  return rates.map((r) => ({
    ...r,
    rate: Number(r.rate),
    updated_at: r.updated_at.toISOString(),
  }))
}

// ─────────────────────────────────────────
// Get all employees with CTC data for salary table
// ─────────────────────────────────────────

export async function getSalaryData() {
  await requireRole(['admin'])

  const employees = await prisma.user.findMany({
    where: { is_active: true },
    select: {
      id: true,
      full_name: true,
      email: true,
      salary_currency: true,
      fixed_ctc: true,
      annual_variable: true,
      retention_bonus: true,
      onetime_bonus: true,
      department: { select: { id: true, name: true } },
    },
    orderBy: [{ department: { name: 'asc' } }, { full_name: 'asc' }],
  })

  return employees.map((e) => ({
    id: e.id,
    full_name: e.full_name,
    email: e.email,
    salary_currency: e.salary_currency,
    fixed_ctc: e.fixed_ctc ? Number(e.fixed_ctc) : null,
    annual_variable: e.annual_variable ? Number(e.annual_variable) : null,
    retention_bonus: e.retention_bonus ? Number(e.retention_bonus) : null,
    onetime_bonus: e.onetime_bonus ? Number(e.onetime_bonus) : null,
    department_name: e.department?.name ?? '—',
  }))
}
