'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronRight, Users, TrendingUp, DollarSign } from 'lucide-react'
import type { FounderViewResult, FounderDeptRow } from '@/lib/db/aop'

// ── Formatting helpers ──────────────────────────────────────────────────────

function fmtInr(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`
  return `₹${n.toLocaleString('en-IN')}`
}

function fmtCurrency(n: number, currency: string) {
  if (currency === 'INR') return fmtInr(n)
  if (currency === 'AED') return `AED ${(n / 1000).toFixed(0)}K`
  if (currency === 'USD') return `$${(n / 1000).toFixed(0)}K`
  return `${currency} ${n}`
}

function pctColor(pct: number) {
  if (pct >= 100) return 'text-emerald-400'
  if (pct >= 80) return 'text-amber-400'
  return 'text-red-400'
}

// ── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100)
  const barColor = pct >= 100 ? 'bg-emerald-400' : pct >= 80 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="h-1 rounded-full bg-white/10 w-full mt-1">
      <div className={`h-1 rounded-full ${barColor} transition-all`} style={{ width: `${clamped}%` }} />
    </div>
  )
}

// ── Metric display name ───────────────────────────────────────────────────────

const METRIC_LABELS: Record<string, string> = {
  delivered_revenue: 'Delivered Revenue',
  gross_margin: 'Gross Margin',
  gmv: 'New Sales',
}

// ── Org KPI card ─────────────────────────────────────────────────────────────

function OrgKpiCard({
  metricKey,
  data,
  displayCurrency,
  exchangeRates,
}: {
  metricKey: 'delivered_revenue' | 'gross_margin' | 'gmv'
  data: { target: number; actual: number; pct: number }
  displayCurrency: 'INR' | 'local'
  exchangeRates: Record<string, number>
}) {
  // For org totals, everything is already in INR so we show INR directly
  const target = data.target
  const actual = data.actual
  const pct = data.pct

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm p-6 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-indigo-400" />
        <span className="text-sm font-medium text-white/70">{METRIC_LABELS[metricKey]}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-bold text-white">{fmtInr(actual)}</p>
          <p className="text-xs text-white/40 mt-0.5">of {fmtInr(target)} target</p>
        </div>
        <span className={`text-2xl font-bold ${pctColor(pct)}`}>{pct}%</span>
      </div>
      <ProgressBar pct={pct} />
    </div>
  )
}

// ── Employee expanded row ─────────────────────────────────────────────────────

function EmployeeRow({
  emp,
  displayCurrency,
  exchangeRates,
}: {
  emp: FounderViewResult['departments'][number]['employees'][number]
  displayCurrency: 'INR' | 'local'
  exchangeRates: Record<string, number>
}) {
  const ctcDisplay = displayCurrency === 'INR'
    ? fmtInr(emp.ctcInr)
    : fmtCurrency(emp.ctc, emp.currency)

  const metrics = ['delivered_revenue', 'gross_margin', 'gmv'] as const

  return (
    <tr className="border-t border-white/5 hover:bg-white/[0.03] transition-colors">
      <td className="py-2.5 pl-12 pr-3">
        <span className="text-sm text-white/70">{emp.name}</span>
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className="text-xs text-white/40">{emp.currency}</span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="text-sm text-white/60">{ctcDisplay}</span>
        {displayCurrency !== 'INR' && emp.currency !== 'INR' && (
          <div className="text-[10px] text-white/30">{fmtInr(emp.ctcInr)}</div>
        )}
      </td>
      {metrics.map((m) => {
        const target = emp.targets[m] ?? 0
        const actual = emp.actuals[m] ?? 0
        const pct = target > 0 ? Math.round((actual / target) * 100) : 0
        return (
          <td key={m} className="px-3 py-2.5 text-right">
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-xs text-white/50">{fmtInr(actual)}</span>
              <span className="text-[10px] text-white/30">/ {fmtInr(target)}</span>
              <span className={`text-[10px] font-semibold ${pctColor(pct)}`}>{pct}%</span>
            </div>
          </td>
        )
      })}
    </tr>
  )
}

// ── Department row (expandable) ───────────────────────────────────────────────

function DeptRow({
  dept,
  displayCurrency,
  exchangeRates,
}: {
  dept: FounderDeptRow
  displayCurrency: 'INR' | 'local'
  exchangeRates: Record<string, number>
}) {
  const [expanded, setExpanded] = useState(false)
  const metrics = ['delivered_revenue', 'gross_margin', 'gmv'] as const

  const ctcDisplay = displayCurrency === 'INR' ? fmtInr(dept.totalCtcInr) : fmtInr(dept.totalCtcInr)

  return (
    <>
      <tr
        className="border-t border-white/10 hover:bg-white/5 transition-colors cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Dept name + expand */}
        <td className="py-3 pl-4 pr-3">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-white/40 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-white/40 shrink-0" />
            )}
            <span className="text-sm font-medium text-white">{dept.department.name}</span>
          </div>
        </td>
        {/* Team size */}
        <td className="px-3 py-3 text-center">
          <span className="text-sm text-white/70">{dept.teamSize}</span>
        </td>
        {/* Total CTC */}
        <td className="px-3 py-3 text-right">
          <span className="text-sm text-white/70">{ctcDisplay}</span>
        </td>
        {/* Metrics */}
        {metrics.map((m) => {
          const { target, actual, pct } = dept.metrics[m]
          return (
            <td key={m} className="px-3 py-3 text-right">
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-sm text-white/80">{fmtInr(actual)}</span>
                <span className="text-[11px] text-white/40">/ {fmtInr(target)}</span>
                <span className={`text-[11px] font-semibold ${pctColor(pct)}`}>{pct}%</span>
                <ProgressBar pct={pct} />
              </div>
            </td>
          )
        })}
      </tr>
      {expanded && dept.employees.map((emp) => (
        <EmployeeRow
          key={emp.id}
          emp={emp}
          displayCurrency={displayCurrency}
          exchangeRates={exchangeRates}
        />
      ))}
      {expanded && dept.employees.length === 0 && (
        <tr className="border-t border-white/5">
          <td colSpan={9} className="py-3 pl-12 text-xs text-white/30 italic">
            No employees with AOP targets in this department
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────

interface Props {
  data: FounderViewResult
  selectedFy: string
  fiscalYears: string[]
}

export function FounderViewDashboard({ data, selectedFy, fiscalYears }: Props) {
  const router = useRouter()
  const [displayCurrency, setDisplayCurrency] = useState<'INR' | 'local'>('INR')

  function handleFyChange(fy: string) {
    router.push(`/admin/founder?fy=${fy}`)
  }

  const orgMetrics = ['delivered_revenue', 'gross_margin', 'gmv'] as const

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* FY selector */}
        <select
          value={selectedFy}
          onChange={(e) => handleFyChange(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {fiscalYears.map((fy) => (
            <option key={fy} value={fy} className="bg-[#0c0a1a]">
              {fy}
            </option>
          ))}
        </select>

        {/* Currency toggle */}
        <div className="flex rounded-lg bg-white/[0.06] border border-white/10 p-0.5">
          {(['INR', 'local'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setDisplayCurrency(c)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                displayCurrency === c
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {c === 'INR' ? 'INR' : 'Local Currency'}
            </button>
          ))}
        </div>
      </div>

      {/* Org-level KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {orgMetrics.map((m) => (
          <OrgKpiCard
            key={m}
            metricKey={m}
            data={data.orgTotals[m]}
            displayCurrency={displayCurrency}
            exchangeRates={data.exchangeRates}
          />
        ))}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
          <Users className="h-5 w-5 text-indigo-400 shrink-0" />
          <div>
            <p className="text-xs text-white/40">Departments</p>
            <p className="text-lg font-bold text-white">{data.departments.length}</p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
          <Users className="h-5 w-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-xs text-white/40">Total Team</p>
            <p className="text-lg font-bold text-white">
              {data.departments.reduce((s, d) => s + d.teamSize, 0)}
            </p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
          <DollarSign className="h-5 w-5 text-amber-400 shrink-0" />
          <div>
            <p className="text-xs text-white/40">Total CTC (INR)</p>
            <p className="text-lg font-bold text-white">
              {fmtInr(data.departments.reduce((s, d) => s + d.totalCtcInr, 0))}
            </p>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-violet-400 shrink-0" />
          <div>
            <p className="text-xs text-white/40">Avg Achievement</p>
            <p className="text-lg font-bold text-white">
              {Math.round(
                (data.orgTotals.delivered_revenue.pct +
                  data.orgTotals.gross_margin.pct +
                  data.orgTotals.gmv.pct) / 3
              )}%
            </p>
          </div>
        </div>
      </div>

      {/* Department table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-white/5">
                <th className="py-3 pl-4 pr-3 text-left text-xs font-medium text-white/50 uppercase tracking-wide">
                  Department
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-white/50 uppercase tracking-wide">
                  Team
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-white/50 uppercase tracking-wide">
                  Total CTC
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-white/50 uppercase tracking-wide">
                  Delivered Rev
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-white/50 uppercase tracking-wide">
                  Gross Margin
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-white/50 uppercase tracking-wide">
                  New Sales
                </th>
              </tr>
            </thead>
            <tbody>
              {data.departments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-white/30">
                    No AOP data found for {selectedFy}
                  </td>
                </tr>
              ) : (
                data.departments.map((dept) => (
                  <DeptRow
                    key={dept.department.id}
                    dept={dept}
                    displayCurrency={displayCurrency}
                    exchangeRates={data.exchangeRates}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exchange rates reference */}
      {Object.keys(data.exchangeRates).filter((k) => k !== 'INR').length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-white/40 font-medium uppercase tracking-wide mb-2">
            Exchange Rates ({selectedFy})
          </p>
          <div className="flex flex-wrap gap-4">
            {Object.entries(data.exchangeRates)
              .filter(([k]) => k !== 'INR')
              .map(([from, rate]) => (
                <span key={from} className="text-sm text-white/60">
                  1 {from} = {rate.toFixed(4)} INR
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
