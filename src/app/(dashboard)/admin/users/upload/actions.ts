'use server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { validateEmail } from '@/lib/validate'
import { sendInviteEmail } from '@/lib/email'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import type { ActionResult } from '@/lib/types'

export interface UploadSummary {
  added: number
  invited: number
  updated: number
  skipped: number
  skippedReasons: string[]
}

export interface SheetPreview {
  headers: string[]
  previewRows: string[][]
  csvText: string
}

// ── helpers ──────────────────────────────────────────────────────────────────

function parseCsvText(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = splitCsvLine(lines[0])
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()]))
  })
}

function splitCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = '', inQuote = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQuote = !inQuote }
    else if (line[i] === ',' && !inQuote) { result.push(cur.trim()); cur = '' }
    else { cur += line[i] }
  }
  result.push(cur.trim())
  return result
}

function extractSheetId(url: string): { id: string; gid: string } | null {
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  const gidMatch = url.match(/[#&?]gid=(\d+)/)
  if (!idMatch) return null
  return { id: idMatch[1], gid: gidMatch?.[1] ?? '0' }
}

// ── server actions ────────────────────────────────────────────────────────────

export async function fetchSheetPreview(url: string): Promise<ActionResult<SheetPreview>> {
  const parsed = extractSheetId(url)
  if (!parsed) return { data: null, error: 'Invalid Google Sheets URL. Make sure it contains /spreadsheets/d/{id}' }

  const exportUrl = `https://docs.google.com/spreadsheets/d/${parsed.id}/export?format=csv&gid=${parsed.gid}`

  let csvText: string
  try {
    const res = await fetch(exportUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { data: null, error: 'Sheet is not publicly accessible. Share it with "Anyone with the link" (Viewer access).' }
      }
      return { data: null, error: `Failed to fetch sheet: HTTP ${res.status}` }
    }
    csvText = await res.text()
  } catch {
    return { data: null, error: 'Could not reach Google Sheets. Check the URL and try again.' }
  }

  const lines = csvText.trim().split(/\r?\n/)
  if (lines.length < 1) return { data: null, error: 'Sheet appears to be empty.' }

  const headers = splitCsvLine(lines[0])
  const previewRows = lines.slice(1, 4).map(splitCsvLine)

  return { data: { headers, previewRows, csvText }, error: null }
}

export async function uploadUsersWithMapping(
  _prev: ActionResult<UploadSummary>,
  formData: FormData
): Promise<ActionResult<UploadSummary>> {
  const user = await requireRole(['admin'])

  const source = formData.get('source') as string
  let csvText: string

  if (source === 'sheets') {
    const sheetUrl = formData.get('sheetUrl') as string
    const result = await fetchSheetPreview(sheetUrl)
    if (result.error || !result.data) return { data: null, error: result.error ?? 'Failed to fetch sheet' }
    csvText = result.data.csvText
  } else {
    csvText = formData.get('csvText') as string
    if (!csvText) return { data: null, error: 'No CSV data provided' }
  }

  // Read column mappings from formData (map_fieldName → csvColumnHeader)
  const colMap: Record<string, string> = {}
  for (const key of ['emp_code', 'zimyo_id', 'email', 'full_name', 'role', 'department', 'designation', 'manager_email', 'variable_pay']) {
    const val = formData.get(`map_${key}`) as string
    if (val) colMap[key] = val
  }

  if (!colMap.email) return { data: null, error: 'Email column mapping is required.' }
  if (!colMap.full_name) return { data: null, error: 'Full Name column mapping is required.' }

  const rows = parseCsvText(csvText)
  if (rows.length === 0) return { data: null, error: 'CSV is empty or could not be parsed.' }

  let added = 0, updated = 0, skipped = 0, invited = 0
  const skippedReasons: string[] = []
  const emailToId = new Map<string, string>()
  const validRows: { original: Record<string, string>; mapped: Record<string, string> }[] = []
  const newlyCreatedEmails: { email: string; name: string; token: string }[] = []

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'

  for (const row of rows) {
    const mapped: Record<string, string> = {}
    for (const [field, col] of Object.entries(colMap)) {
      mapped[field] = row[col] ?? ''
    }

    if (!validateEmail(mapped.email)) {
      skipped++
      skippedReasons.push(`Skipped: invalid email "${mapped.email || '(empty)'}"`)
      continue
    }

    const VALID_ROLES = ['employee', 'manager', 'hrbp', 'admin'] as const
    const userData: Record<string, unknown> = {
      email: mapped.email,
      full_name: mapped.full_name || mapped.email,
      designation: mapped.designation || null,
      synced_at: new Date(),
    }
    if (mapped.role) {
      const roleLower = mapped.role.toLowerCase().trim()
      if (VALID_ROLES.includes(roleLower as typeof VALID_ROLES[number])) {
        userData.role = roleLower
      }
    }
    if (mapped.emp_code) userData.emp_code = mapped.emp_code
    if (mapped.zimyo_id) userData.zimyo_id = mapped.zimyo_id
    if (mapped.variable_pay) {
      const pay = parseFloat(mapped.variable_pay.replace(/[^0-9.]/g, ''))
      if (!isNaN(pay)) userData.variable_pay = pay
    }

    // Handle department lookup by name if provided
    if (mapped.department) {
      const dept = await prisma.department.findFirst({ where: { name: mapped.department } })
      if (dept) userData.department_id = dept.id
    }

    const existing = await prisma.user.findUnique({
      where: { email: mapped.email },
      select: { id: true },
    })

    if (existing) {
      emailToId.set(mapped.email, existing.id)
      await prisma.user.update({
        where: { email: mapped.email },
        data: userData as Parameters<typeof prisma.user.update>[0]['data'],
      })
      updated++
    } else {
      // Generate invite token for new users
      const invite_token = crypto.randomBytes(32).toString('hex')
      const invite_token_expires_at = new Date(Date.now() + 72 * 60 * 60 * 1000) // 72hr expiry

      const newUser = await prisma.user.create({
        data: {
          ...(userData as Parameters<typeof prisma.user.create>[0]['data']),
          is_active: true,
          zimyo_id: (userData.zimyo_id as string | undefined) ?? `manual_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          invite_token,
          invite_token_expires_at,
          invited_at: new Date(),
        },
      })
      emailToId.set(mapped.email, newUser.id)
      newlyCreatedEmails.push({ email: mapped.email, name: mapped.full_name || mapped.email, token: invite_token })
      added++
    }
    validRows.push({ original: row, mapped })
  }

  // Link managers
  if (colMap.manager_email) {
    for (const { mapped } of validRows) {
      if (mapped.manager_email && validateEmail(mapped.manager_email)) {
        const managerId = emailToId.get(mapped.manager_email)
        if (managerId) {
          await prisma.user.update({
            where: { email: mapped.email },
            data: { manager_id: managerId },
          })
        }
      }
    }
  }

  // Send invite emails to newly created users
  for (const { email, name, token } of newlyCreatedEmails) {
    const inviteUrl = `${appUrl}/login/accept-invite?token=${token}`
    try {
      await sendInviteEmail(email, inviteUrl, name)
      invited++
    } catch (err) {
      console.error(`Failed to send invite email to ${email}:`, err)
      skippedReasons.push(`Invite email failed for ${email}`)
    }
  }

  await prisma.auditLog.create({
    data: {
      changed_by: user.id,
      action: 'csv_upload',
      entity_type: 'user',
      new_value: { added, updated, skipped, invited, source },
    },
  })

  revalidatePath('/admin/users')
  return { data: { added, updated, skipped, invited, skippedReasons }, error: null }
}

// Alias for backward compat
export async function uploadUsersCsv(
  prev: ActionResult<UploadSummary>,
  formData: FormData
): Promise<ActionResult<UploadSummary>> {
  return uploadUsersWithMapping(prev, formData)
}
