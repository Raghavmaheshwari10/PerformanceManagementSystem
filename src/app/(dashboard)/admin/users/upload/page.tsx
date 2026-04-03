'use client'

import { useState, useActionState, useCallback } from 'react'
import { fetchSheetPreview, uploadUsersWithMapping, type UploadSummary } from './actions'
import { SubmitButton } from '@/components/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Download } from 'lucide-react'
import type { ActionResult } from '@/lib/types'

// ── constants ─────────────────────────────────────────────────────────────────

const TARGET_FIELDS = [
  { key: 'emp_code',      label: 'Employee Code',        required: false },
  { key: 'zimyo_id',      label: 'Employee ID (Zimyo)',  required: false },
  { key: 'email',         label: 'Email',                required: true  },
  { key: 'full_name',     label: 'Full Name',            required: true  },
  { key: 'department',    label: 'Department',           required: false },
  { key: 'designation',   label: 'Designation / Title',  required: false },
  { key: 'manager_email', label: 'Manager Email',        required: false },
  { key: 'variable_pay',  label: 'Variable Pay (₹)',     required: false },
]

const INITIAL: ActionResult<UploadSummary> = {
  data: { added: 0, updated: 0, skipped: 0, invited: 0, skippedReasons: [] },
  error: null,
}

// ── helpers ───────────────────────────────────────────────────────────────────

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

function parseHeaders(text: string): { headers: string[]; previewRows: string[][] } {
  const lines = text.trim().split(/\r?\n/).slice(0, 4)
  const headers = splitCsvLine(lines[0] ?? '')
  const previewRows = lines.slice(1).map(splitCsvLine)
  return { headers, previewRows }
}

function autoDetect(headers: string[]): Record<string, string> {
  const lower = headers.map(h => h.toLowerCase().replace(/[\s_-]+/g, '_'))
  const aliases: Record<string, string[]> = {
    emp_code:      ['emp_code', 'employee_code', 'emp_no', 'employee_no', 'employee_number'],
    zimyo_id:      ['zimyo_id', 'employee_id', 'emp_id', 'staff_id', 'id'],
    email:         ['email', 'email_address', 'work_email', 'e_mail'],
    full_name:     ['full_name', 'name', 'employee_name', 'staff_name', 'fullname'],
    department:    ['department', 'dept', 'team', 'division', 'business_unit'],
    designation:   ['designation', 'title', 'job_title', 'position', 'role'],
    manager_email: ['manager_email', 'reporting_manager_email', 'reporting_manager', 'manager'],
    variable_pay:  ['variable_pay', 'variable', 'bonus', 'incentive', 'ctc'],
  }
  const mapping: Record<string, string> = {}
  for (const [field, aliasList] of Object.entries(aliases)) {
    for (const alias of aliasList) {
      const idx = lower.indexOf(alias)
      if (idx !== -1) { mapping[field] = headers[idx]; break }
    }
  }
  return mapping
}

// ── CSV template ─────────────────────────────────────────────────────────────

const CSV_TEMPLATE_HEADERS = ['emp_code', 'email', 'full_name', 'department', 'designation', 'manager_email', 'variable_pay']
const CSV_TEMPLATE_SAMPLE = [
  'EMP001,john.doe@company.com,John Doe,Engineering,Senior Engineer,jane.smith@company.com,50000',
  'EMP002,jane.smith@company.com,Jane Smith,Engineering,Engineering Manager,,75000',
  'EMP003,alex.kumar@company.com,Alex Kumar,Sales,Sales Executive,jane.smith@company.com,40000',
]

function downloadCsvTemplate() {
  const content = [CSV_TEMPLATE_HEADERS.join(','), ...CSV_TEMPLATE_SAMPLE].join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'user_import_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ── main component ────────────────────────────────────────────────────────────

type Source = 'csv' | 'sheets'
type Stage  = 'source' | 'mapping' | 'done'

export default function UploadUsersPage() {
  const [source,      setSource]      = useState<Source>('csv')
  const [stage,       setStage]       = useState<Stage>('source')
  const [headers,     setHeaders]     = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<string[][]>([])
  const [mapping,     setMapping]     = useState<Record<string, string>>({})
  const [csvText,     setCsvText]     = useState('')
  const [sheetUrl,    setSheetUrl]    = useState('')
  const [fetching,    setFetching]    = useState(false)
  const [fetchError,  setFetchError]  = useState('')
  const [showResults, setShowResults] = useState(false)

  const [state, action] = useActionState(async (...args: Parameters<typeof uploadUsersWithMapping>) => {
    const result = await uploadUsersWithMapping(...args)
    if (!result.error) setShowResults(true)
    return result
  }, INITIAL)

  // ── source handlers ────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const { headers: h, previewRows: p } = parseHeaders(text)
    setCsvText(text)
    setHeaders(h)
    setPreviewRows(p)
    setMapping(autoDetect(h))
    setStage('mapping')
  }

  async function handleFetchSheet() {
    if (!sheetUrl) return
    setFetching(true)
    setFetchError('')
    const result = await fetchSheetPreview(sheetUrl)
    setFetching(false)
    if (result.error || !result.data) { setFetchError(result.error ?? 'Unknown error'); return }
    setCsvText(result.data.csvText)
    setHeaders(result.data.headers)
    setPreviewRows(result.data.previewRows)
    setMapping(autoDetect(result.data.headers))
    setStage('mapping')
  }

  function reset() {
    setStage('source'); setCsvText(''); setHeaders([]); setMapping({}); setSheetUrl(''); setFetchError(''); setShowResults(false)
  }

  // ── done stage ─────────────────────────────────────────────────────────────

  if (showResults && state.data) {
    return (
      <div className="max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Import Complete</h1>
          <Link href="/admin/users">
            <Button variant="outline" size="sm">← Back to Users</Button>
          </Link>
        </div>
        <div className="rounded-lg border p-4 space-y-4">
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="rounded-md bg-green-50 dark:bg-green-950/30 p-3">
              <p className="text-3xl font-bold text-green-700 dark:text-green-400">{state.data!.added}</p>
              <p className="text-xs text-green-600 dark:text-green-500 mt-1">Created</p>
            </div>
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-3">
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{state.data!.updated}</p>
              <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">Updated</p>
            </div>
            <div className="rounded-md bg-purple-50 dark:bg-purple-950/30 p-3">
              <p className="text-3xl font-bold text-purple-700 dark:text-purple-400">{state.data!.invited}</p>
              <p className="text-xs text-purple-600 dark:text-purple-500 mt-1">Invited</p>
            </div>
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-3">
              <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">{state.data!.skipped}</p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">Skipped</p>
            </div>
          </div>
          {state.data!.skippedReasons.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Skip reasons:</p>
              <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                {state.data!.skippedReasons.map((r, i) => (
                  <li key={i} className="text-xs text-muted-foreground">• {r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <Button variant="outline" onClick={reset}>Import More</Button>
      </div>
    )
  }

  // ── mapping stage ──────────────────────────────────────────────────────────

  if (stage === 'mapping') {
    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Map Columns</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Match your spreadsheet columns to the right fields. Required fields are marked <span className="text-destructive">*</span>
          </p>
        </div>

        <form action={action} className="space-y-6">
          {/* Hidden: source + data */}
          <input type="hidden" name="source"   value={source} />
          <input type="hidden" name="csvText"  value={source === 'csv'    ? csvText  : ''} />
          <input type="hidden" name="sheetUrl" value={source === 'sheets' ? sheetUrl : ''} />

          {state.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
          )}

          {/* Column mapping grid */}
          <div className="rounded-lg border divide-y">
            <div className="grid grid-cols-2 gap-4 px-4 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Target field</span>
              <span>Your column</span>
            </div>
            {TARGET_FIELDS.map(field => (
              <div key={field.key} className="grid grid-cols-2 items-center gap-4 px-4 py-3">
                <div>
                  <span className="text-sm font-medium">{field.label}</span>
                  {field.required && <span className="ml-1 text-destructive text-xs">*</span>}
                </div>
                <select
                  name={`map_${field.key}`}
                  value={mapping[field.key] ?? ''}
                  onChange={e => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— skip this field —</option>
                  {headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Data preview */}
          {previewRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Data preview <span className="font-normal text-muted-foreground">(first {previewRows.length} rows)</span></p>
              <div className="overflow-x-auto rounded-lg border text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      {headers.map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                          {h}
                          {Object.values(mapping).includes(h) && (
                            <span className="ml-1 text-primary">✓</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-t">
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-2 whitespace-nowrap text-muted-foreground">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">Columns with ✓ are mapped to a field above.</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={reset}>← Back</Button>
            <SubmitButton pendingLabel="Importing users…">Import {source === 'sheets' ? 'from Sheet' : 'CSV'}</SubmitButton>
          </div>
        </form>
      </div>
    )
  }

  // ── source selection stage ─────────────────────────────────────────────────

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Import Users</h1>
        <Link href="/admin/users">
          <Button variant="ghost" size="sm">← Back to Users</Button>
        </Link>
      </div>

      {/* Source tabs */}
      <div className="flex rounded-lg border overflow-hidden text-sm">
        {(['csv', 'sheets'] as Source[]).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => { setSource(s); setFetchError('') }}
            className={`flex-1 py-2.5 font-medium transition-colors ${
              source === s ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            {s === 'csv' ? '📄 Upload CSV' : '📊 Google Sheets'}
          </button>
        ))}
      </div>

      {source === 'csv' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload any CSV file — you&apos;ll map the columns to the right fields in the next step.
          </p>

          {/* Download template */}
          <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Need a template?</p>
                <p className="text-xs text-muted-foreground mt-0.5">Download a pre-filled CSV template with sample data and all supported columns.</p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadCsvTemplate} className="gap-1.5 shrink-0">
                <Download className="h-3.5 w-3.5" />
                Download Template
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">CSV File</Label>
            <Input id="file" type="file" accept=".csv,.tsv" onChange={handleFileChange} />
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Any column order works</p>
            <p>Commonly recognised columns: <code>email</code>, <code>full_name</code>, <code>department</code>, <code>designation</code>, <code>manager_email</code>, <code>variable_pay</code></p>
          </div>
        </div>
      )}

      {source === 'sheets' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Paste a Google Sheets URL. The sheet must be shared with{' '}
            <strong>"Anyone with the link"</strong> (Viewer access).
          </p>
          <div className="space-y-2">
            <Label htmlFor="sheetUrl">Google Sheets URL</Label>
            <Input
              id="sheetUrl"
              value={sheetUrl}
              onChange={e => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
            />
          </div>
          {fetchError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{fetchError}</p>
          )}
          <Button onClick={handleFetchSheet} disabled={!sheetUrl || fetching}>
            {fetching ? 'Fetching sheet…' : 'Fetch & Map Columns →'}
          </Button>
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">How to share your sheet</p>
            <p>File → Share → General access → <strong>Anyone with the link</strong> → Viewer</p>
          </div>
        </div>
      )}
    </div>
  )
}
