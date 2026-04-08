'use client'

import { useActionState, useState, useCallback, useRef } from 'react'
import { uploadMisActuals, downloadMisTemplate } from './actions'
import type { ActionResult } from '@/lib/types'
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'

type UploadResult = { uploaded: number; failed: number; errors: string[] }

const VALID_METRICS = ['delivered_revenue', 'gross_margin', 'gmv']
const VALID_MONTHS = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar']

interface ParsedRow {
  email: string
  metric: string
  month: string
  fy: string
  value: string
}

function parseCsvPreview(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const emailIdx = headers.indexOf('employee_email')
  const metricIdx = headers.indexOf('metric')
  const monthIdx = headers.indexOf('month')
  const fyIdx = headers.indexOf('fy')
  const valueIdx = headers.indexOf('actual_value')

  if (emailIdx === -1 || metricIdx === -1 || monthIdx === -1 || fyIdx === -1 || valueIdx === -1) {
    return []
  }

  const rows: ParsedRow[] = []
  for (let i = 1; i < Math.min(lines.length, 6); i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    if (vals.length < headers.length) continue
    rows.push({
      email: vals[emailIdx],
      metric: vals[metricIdx],
      month: vals[monthIdx],
      fy: vals[fyIdx],
      value: vals[valueIdx],
    })
  }
  return rows
}

function formatIndianNumber(val: string): string {
  const num = Number(val)
  if (isNaN(num)) return val
  return num.toLocaleString('en-IN')
}

const initialState = { data: null, error: null } as unknown as ActionResult<UploadResult>

export function UploadForm() {
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, isPending] = useActionState(uploadMisActuals, initialState)

  const updatePreview = useCallback((text: string) => {
    setCsvText(text)
    const parsed = parseCsvPreview(text)
    setPreview(parsed)
    const lines = text.trim().split(/\r?\n/).filter(l => l.trim())
    setTotalRows(Math.max(0, lines.length - 1))
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      updatePreview(text)
    }
    reader.readAsText(file)
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    updatePreview(e.target.value)
  }

  async function handleDownloadTemplate() {
    const template = await downloadMisTemplate()
    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mis-actuals-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* CSV Format Info */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
          <h2 className="text-sm font-semibold text-gray-900">CSV Format</h2>
        </div>
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            <span className="font-mono text-gray-900">employee_email, metric, month, fy, actual_value</span>
          </p>
          <p>
            <span className="text-slate-400">Metrics:</span>{' '}
            <span className="font-mono text-slate-600">{VALID_METRICS.join(', ')}</span>
          </p>
          <p>
            <span className="text-slate-400">Months:</span>{' '}
            <span className="font-mono text-slate-600">{VALID_MONTHS.join(', ')}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <Download className="h-3.5 w-3.5" />
          Download Template
        </button>
      </div>

      {/* Upload Section */}
      <form ref={formRef} action={formAction} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="h-4 w-4 text-indigo-600" />
          <h2 className="text-sm font-semibold text-gray-900">Upload</h2>
        </div>

        {/* File Input */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Choose a CSV file</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-700 hover:file:bg-indigo-200 file:cursor-pointer file:transition-colors"
          />
        </div>

        {/* Or paste */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Or paste CSV data below</label>
          <textarea
            value={csvText}
            onChange={handleTextChange}
            rows={6}
            placeholder="employee_email,metric,month,fy,actual_value&#10;raghav@emb.global,delivered_revenue,apr,FY26,8500000"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 font-mono placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 resize-y"
          />
        </div>

        {/* Hidden input to pass CSV text to server action */}
        <input type="hidden" name="csv" value={csvText} />

        {/* Preview Table */}
        {preview.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-slate-500 mb-2">
              Preview (first {preview.length} of {totalRows} rows)
            </p>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Metric</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Month</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">FY</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-200 last:border-0">
                      <td className="px-3 py-1.5 text-slate-600 truncate max-w-[180px]">{row.email}</td>
                      <td className="px-3 py-1.5 text-slate-600">{row.metric}</td>
                      <td className="px-3 py-1.5 text-slate-600">{row.month}</td>
                      <td className="px-3 py-1.5 text-slate-600">{row.fy}</td>
                      <td className="px-3 py-1.5 text-slate-600 text-right font-mono">{formatIndianNumber(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isPending || !csvText.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Upload className="h-4 w-4" />
          {isPending ? 'Processing...' : 'Upload & Process'}
        </button>
      </form>

      {/* Results Section */}
      {state.data && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Results</h2>
          <div className="flex items-center gap-6 mb-3">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-slate-700">
                Uploaded: <span className="font-semibold text-green-600">{state.data.uploaded}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-slate-700">
                Failed: <span className="font-semibold text-red-600">{state.data.failed}</span>
              </span>
            </div>
          </div>
          {state.data.errors.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 mb-1">Errors:</p>
              {state.data.errors.map((err, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-xs text-red-600">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-red-500" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error (top-level) */}
      {state.error && !state.data && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {state.error}
        </div>
      )}
    </div>
  )
}
