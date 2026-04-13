'use client'

import { useActionState, useState, useMemo, useRef } from 'react'
import { saveExchangeRates, uploadSalaryCsv } from './actions'
import type { ActionResult } from '@/lib/types'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

interface EmployeeRow {
  id: string
  full_name: string
  email: string
  is_active?: boolean
  salary_currency: string
  fixed_ctc: number | null
  annual_variable: number | null
  retention_bonus: number | null
  onetime_bonus: number | null
  department_name: string
}

interface SalaryPageProps {
  currentFy: string
  initialRates: Record<string, number>
  employees: EmployeeRow[]
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

const FY_OPTIONS = ['FY24', 'FY25', 'FY26', 'FY27', 'FY28']

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '\u20B9',
  AED: 'AED ',
  USD: '$',
}

function formatAmount(value: number | null, currency: string): string {
  if (value === null || value === 0) return '—'
  const symbol = CURRENCY_SYMBOLS[currency] ?? ''
  if (value >= 10000000) return `${symbol}${(value / 10000000).toFixed(2)}Cr`
  if (value >= 100000) return `${symbol}${(value / 100000).toFixed(2)}L`
  if (value >= 1000) return `${symbol}${(value / 1000).toFixed(1)}K`
  return `${symbol}${value.toFixed(0)}`
}

function formatInrEquivalent(value: number | null, rate: number): string {
  if (value === null || value === 0 || rate === 0) return ''
  const inr = value * rate
  return `(${formatAmount(inr, 'INR')})`
}

function totalCtc(emp: EmployeeRow): number {
  return (emp.fixed_ctc ?? 0) + (emp.annual_variable ?? 0) + (emp.retention_bonus ?? 0) + (emp.onetime_bonus ?? 0)
}

// ─────────────────────────────────────────
// Component
// ─────────────────────────────────────────

export function SalaryPage({ currentFy, initialRates, employees }: SalaryPageProps) {
  // Exchange rates state
  const [selectedFy, setSelectedFy] = useState(currentFy)
  const [rates, setRates] = useState(initialRates)
  const [aedRate, setAedRate] = useState(String(initialRates.AED ?? '22.80'))
  const [usdRate, setUsdRate] = useState(String(initialRates.USD ?? '85.60'))

  const initialRateState = { data: null, error: null } as ActionResult
  const [rateState, rateAction, ratesPending] = useActionState(saveExchangeRates, initialRateState)

  // CSV upload state
  const [csvText, setCsvText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const initialUploadState = {
    data: null,
    error: null,
  } as unknown as ActionResult<{ uploaded: number; failed: number; errors: string[] }>
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadSalaryCsv, initialUploadState)

  // Table filters
  const [search, setSearch] = useState('')
  const [currencyFilter, setCurrencyFilter] = useState('ALL')

  // Filtered employees
  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const matchSearch =
        !search ||
        e.full_name.toLowerCase().includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase())
      const matchCurrency = currencyFilter === 'ALL' || e.salary_currency === currencyFilter
      return matchSearch && matchCurrency
    })
  }, [employees, search, currencyFilter])

  // Get rate for a currency
  const getRate = (currency: string) => {
    if (currency === 'INR') return 1
    return rates[currency] ?? 0
  }

  // Total CTC in INR
  const totalCtcInr = useMemo(() => {
    return filtered.reduce((sum, emp) => {
      const rate = getRate(emp.salary_currency)
      return sum + totalCtc(emp) * rate
    }, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, rates])

  // Handle rate save success — update local rates
  const handleRateSubmit = (formData: FormData) => {
    rateAction(formData)
    setRates({
      ...rates,
      AED: parseFloat(aedRate) || 0,
      USD: parseFloat(usdRate) || 0,
    })
  }

  // Export CSV
  const exportCsv = () => {
    const header = 'Name,Email,Department,Currency,Fixed CTC,Annual Variable,Retention Bonus,One-time Bonus,Total CTC,Total CTC (INR)'
    const rows = filtered.map((e) => {
      const rate = getRate(e.salary_currency)
      const total = totalCtc(e)
      return [
        e.full_name,
        e.email,
        e.department_name,
        e.salary_currency,
        e.fixed_ctc ?? 0,
        e.annual_variable ?? 0,
        e.retention_bonus ?? 0,
        e.onetime_bonus ?? 0,
        total,
        (total * rate).toFixed(2),
      ].join(',')
    })

    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `salary-data-${selectedFy}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Download template CSV
  const downloadTemplate = () => {
    const template = 'employee_email,fixed_ctc,annual_variable,retention_bonus,onetime_bonus,currency\njohn@company.com,2400000,600000,200000,100000,INR\nsara@company.com,180000,45000,15000,10000,AED'
    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'salary-upload-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* ── Exchange Rates Section ── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Exchange Rates ({selectedFy})</h2>
        <form action={handleRateSubmit}>
          <input type="hidden" name="fiscal_year" value={selectedFy} />
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Fiscal Year</label>
              <select
                value={selectedFy}
                onChange={(e) => setSelectedFy(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
              >
                {FY_OPTIONS.map((fy) => (
                  <option key={fy} value={fy}>
                    {fy}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">1 AED = &#x20B9;</label>
              <input
                type="number"
                name="aed_to_inr"
                step="0.0001"
                value={aedRate}
                onChange={(e) => setAedRate(e.target.value)}
                className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">1 USD = &#x20B9;</label>
              <input
                type="number"
                name="usd_to_inr"
                step="0.0001"
                value={usdRate}
                onChange={(e) => setUsdRate(e.target.value)}
                className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
              />
            </div>

            <button
              type="submit"
              disabled={ratesPending}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
            >
              {ratesPending ? 'Saving...' : 'Save Rates'}
            </button>
          </div>

          {rateState.error && (
            <p className="mt-2 text-sm text-red-600">{rateState.error}</p>
          )}
          {rateState.data === null && rateState.error === null && ratesPending === false && rates.AED ? (
            <p className="mt-2 text-sm text-green-600">
              Rates saved: 1 AED = &#x20B9;{rates.AED?.toFixed(4)} | 1 USD = &#x20B9;{rates.USD?.toFixed(4)}
            </p>
          ) : null}
        </form>
      </div>

      {/* ── CSV Import Section ── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Import CTC Data</h2>
        <form action={uploadAction}>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm cursor-pointer hover:bg-gray-100 transition-colors text-gray-700">
                Choose CSV File
                <input
                  ref={fileInputRef}
                  type="file"
                  name="csv_file"
                  accept=".csv"
                  className="hidden"
                />
              </label>
              <span className="text-xs text-slate-500">or paste below:</span>
            </div>

            <textarea
              name="csv_text"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="email,fixed_ctc,annual_variable,retention_bonus,onetime_bonus,currency"
              rows={4}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 font-mono placeholder:text-slate-400"
            />

            <p className="text-xs text-slate-400">
              Format: email, fixed_ctc, annual_variable, retention_bonus, onetime_bonus, currency (INR/AED/USD)
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={downloadTemplate}
                className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Download Template
              </button>
              <button
                type="submit"
                disabled={uploadPending}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
              >
                {uploadPending ? 'Processing...' : 'Upload & Process'}
              </button>
            </div>

            {uploadState.error && (
              <p className="text-sm text-red-600">{uploadState.error}</p>
            )}
            {uploadState.data && (
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="text-green-600">{uploadState.data.uploaded} updated</span>
                  {uploadState.data.failed > 0 && (
                    <span className="text-red-600 ml-3">{uploadState.data.failed} failed</span>
                  )}
                </p>
                {uploadState.data.errors.length > 0 && (
                  <ul className="text-xs text-red-600 space-y-0.5 max-h-32 overflow-y-auto">
                    {uploadState.data.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </form>
      </div>

      {/* ── Employee Salary Table ── */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Employee Salary Table</h2>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-slate-400"
            />
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
            >
              <option value="ALL">All Currencies</option>
              <option value="INR">INR</option>
              <option value="AED">AED</option>
              <option value="USD">USD</option>
            </select>
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="pb-3 pr-4 px-4 py-3">Name</th>
                <th className="pb-3 pr-4 px-4 py-3">Dept</th>
                <th className="pb-3 pr-4 px-4 py-3">Cur</th>
                <th className="pb-3 pr-4 px-4 py-3 text-right">Fixed CTC</th>
                <th className="pb-3 pr-4 px-4 py-3 text-right">Annual Variable</th>
                <th className="pb-3 pr-4 px-4 py-3 text-right">Retention Bonus</th>
                <th className="pb-3 pr-4 px-4 py-3 text-right">One-time Bonus</th>
                <th className="pb-3 px-4 py-3 text-right">Total CTC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((emp) => {
                const rate = getRate(emp.salary_currency)
                const isNonInr = emp.salary_currency !== 'INR'
                const total = totalCtc(emp)
                return (
                  <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 pr-4 px-4">
                      <div className="font-medium text-gray-900">
                        {emp.full_name}
                        {emp.is_active === false && (
                          <span className="ml-1.5 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Inactive</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">{emp.email}</div>
                    </td>
                    <td className="py-3 pr-4 px-4 text-slate-600">{emp.department_name}</td>
                    <td className="py-3 pr-4 px-4">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">
                        {emp.salary_currency}
                      </span>
                    </td>
                    <AmountCell value={emp.fixed_ctc} currency={emp.salary_currency} rate={rate} isNonInr={isNonInr} />
                    <AmountCell value={emp.annual_variable} currency={emp.salary_currency} rate={rate} isNonInr={isNonInr} />
                    <AmountCell value={emp.retention_bonus} currency={emp.salary_currency} rate={rate} isNonInr={isNonInr} />
                    <AmountCell value={emp.onetime_bonus} currency={emp.salary_currency} rate={rate} isNonInr={isNonInr} />
                    <AmountCell value={total} currency={emp.salary_currency} rate={rate} isNonInr={isNonInr} />
                  </tr>
                )
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No employees found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Total row */}
        {filtered.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
            <span className="text-sm text-slate-500">
              {filtered.length} employee{filtered.length !== 1 ? 's' : ''}
            </span>
            <span className="text-sm font-semibold text-gray-900">
              Total CTC (INR): {formatAmount(totalCtcInr, 'INR')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Amount cell sub-component
// ─────────────────────────────────────────

function AmountCell({
  value,
  currency,
  rate,
  isNonInr,
}: {
  value: number | null
  currency: string
  rate: number
  isNonInr: boolean
}) {
  return (
    <td className="py-3 pr-4 px-4 text-right tabular-nums text-gray-900">
      <div>{formatAmount(value, currency)}</div>
      {isNonInr && value && rate > 0 && (
        <div className="text-xs text-slate-400">{formatInrEquivalent(value, rate)}</div>
      )}
    </td>
  )
}
