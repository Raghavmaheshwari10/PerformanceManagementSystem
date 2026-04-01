'use client'

import { useState } from 'react'
import { downloadCsv } from '@/lib/csv-export'
import {
  RatingDistributionChart,
  CycleTrendChart,
  DeptHeatmapChart,
  PayoutPieChart,
  CompletionTrendChart,
} from '@/components/report-charts'
import type {
  RatingDistData,
  CycleTrendData,
  DeptHeatmapData,
  PayoutPieData,
  CompletionTrendData,
} from '@/components/report-charts'
import { FileDown, TrendingUp, BarChart3, PieChart, Users2, Activity } from 'lucide-react'

/* ── Types ── */

interface CycleSummary {
  cycleId: string
  cycleName: string
  quarter: string
  year: number
  status: string
  scopedEmployeeCount: number
  selfReviewRate: number
  managerReviewRate: number
  totalRated: number
  totalPayout: number
  avgMultiplier: number
  exitedCount: number
  ratingDist: Record<string, number>
}

interface DeptRow {
  departmentName: string
  employeeCount: number
  ratingDist: Record<string, number>
  totalPayout: number
}

interface EmployeeRow {
  employeeName: string
  department: string
  selfRating: string | null
  managerRating: string | null
  finalRating: string | null
  variablePay: number
  multiplier: number
  payoutAmount: number
  isExitFrozen: boolean
  prorationFactor: number | null
}

interface ReportDashboardProps {
  cycles: CycleSummary[]
  deptBreakdown: Record<string, DeptRow[]>       // keyed by cycleId
  employeeRows: Record<string, EmployeeRow[]>    // keyed by cycleId
  title: string
  subtitle?: string
}

const TIER_ORDER = ['FEE', 'EE', 'ME', 'SME', 'BE'] as const
const TIER_LABELS: Record<string, string> = {
  FEE: 'Outstanding', EE: 'Exceeds Expectations', ME: 'Meets Expectations',
  SME: 'Below Expectations', BE: 'Unsatisfactory',
}

const RATING_BADGE: Record<string, string> = {
  FEE: 'bg-emerald-500/20 text-emerald-400',
  EE:  'bg-green-500/20 text-green-400',
  ME:  'bg-blue-500/20 text-blue-400',
  SME: 'bg-amber-500/20 text-amber-400',
  BE:  'bg-red-500/20 text-red-400',
}

type Tab = 'overview' | 'trends' | 'departments' | 'payouts' | 'employees'

export function ReportDashboard({ cycles, deptBreakdown, employeeRows, title, subtitle }: ReportDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [selectedCycleId, setSelectedCycleId] = useState(cycles[0]?.cycleId ?? '')

  const selectedCycle = cycles.find(c => c.cycleId === selectedCycleId) ?? cycles[0]
  const deptData = deptBreakdown[selectedCycleId] ?? []
  const empData = employeeRows[selectedCycleId] ?? []

  /* ── Derived chart data ── */

  const ratingDistData: RatingDistData[] = selectedCycle
    ? TIER_ORDER.map(t => ({
        tier: t,
        label: TIER_LABELS[t],
        count: selectedCycle.ratingDist[t] ?? 0,
      }))
    : []

  const trendData: CycleTrendData[] = [...cycles].reverse().map(c => ({
    cycleName: `${c.quarter} ${c.year}`,
    FEE: c.ratingDist.FEE ?? 0,
    EE: c.ratingDist.EE ?? 0,
    ME: c.ratingDist.ME ?? 0,
    SME: c.ratingDist.SME ?? 0,
    BE: c.ratingDist.BE ?? 0,
  }))

  const deptHeatmapData: DeptHeatmapData[] = deptData.map(d => ({
    department: d.departmentName,
    FEE: d.ratingDist.FEE ?? 0,
    EE: d.ratingDist.EE ?? 0,
    ME: d.ratingDist.ME ?? 0,
    SME: d.ratingDist.SME ?? 0,
    BE: d.ratingDist.BE ?? 0,
  }))

  const payoutPieData: PayoutPieData[] = deptData
    .filter(d => d.totalPayout > 0)
    .map(d => ({ name: d.departmentName, value: d.totalPayout }))

  const completionData: CompletionTrendData[] = [...cycles].reverse().map(c => ({
    cycleName: `${c.quarter} ${c.year}`,
    selfReview: c.selfReviewRate,
    managerReview: c.managerReviewRate,
  }))

  /* ── Export ── */

  function exportEmployeeCsv() {
    if (empData.length === 0) return
    downloadCsv(
      empData.map(e => ({
        Employee: e.employeeName,
        Department: e.department,
        'Self Rating': e.selfRating ?? '',
        'Manager Rating': e.managerRating ?? '',
        'Final Rating': e.finalRating ?? '',
        'Variable Pay': e.variablePay,
        Multiplier: e.multiplier.toFixed(3),
        'Payout Amount': e.payoutAmount,
        'Exit Frozen': e.isExitFrozen ? 'Yes' : 'No',
        Proration: e.prorationFactor != null ? `${(e.prorationFactor * 100).toFixed(1)}%` : '',
      })),
      `report-${selectedCycle?.cycleName ?? 'cycle'}.csv`
    )
  }

  function exportSummaryCsv() {
    downloadCsv(
      cycles.map(c => ({
        Cycle: c.cycleName,
        Quarter: c.quarter,
        Year: c.year,
        Status: c.status,
        Employees: c.scopedEmployeeCount,
        'Self Review %': c.selfReviewRate,
        'Manager Review %': c.managerReviewRate,
        'Total Rated': c.totalRated,
        'Total Payout': c.totalPayout,
        'Avg Multiplier': c.avgMultiplier.toFixed(3),
        Exited: c.exitedCount,
      })),
      'cycle-summary-report.csv'
    )
  }

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'trends', label: 'Trends', icon: TrendingUp },
    { key: 'departments', label: 'Departments', icon: Users2 },
    { key: 'payouts', label: 'Payouts', icon: PieChart },
    { key: 'employees', label: 'Employees', icon: Activity },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="glass appearance-none rounded-lg border border-border bg-muted/30 px-3 py-1.5 pr-8 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            value={selectedCycleId}
            onChange={e => setSelectedCycleId(e.target.value)}
          >
            {cycles.map(c => (
              <option key={c.cycleId} value={c.cycleId}>{c.cycleName}</option>
            ))}
          </select>
          <button
            onClick={exportSummaryCsv}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            title="Export summary CSV"
          >
            <FileDown className="h-3.5 w-3.5" />
            Summary
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-lg bg-muted/30 p-1 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-white/10 text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Tab: Overview ── */}
      {activeTab === 'overview' && selectedCycle && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {[
              { label: 'Employees', value: selectedCycle.scopedEmployeeCount },
              { label: 'Self Review', value: `${selectedCycle.selfReviewRate}%` },
              { label: 'Mgr Review', value: `${selectedCycle.managerReviewRate}%` },
              { label: 'Rated', value: selectedCycle.totalRated },
              { label: 'Total Payout', value: `₹${selectedCycle.totalPayout.toLocaleString('en-IN')}` },
              { label: 'Exited', value: selectedCycle.exitedCount },
            ].map((card, i) => (
              <div
                key={card.label}
                className="glass p-4 text-center"
                style={{ animation: 'countUp 0.5s ease-out both', animationDelay: `${i * 0.08}s` }}
              >
                <p className="text-2xl font-extrabold tabular-nums">{card.value}</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Rating Distribution */}
          <div className="glass p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Rating Distribution</h3>
            <RatingDistributionChart data={ratingDistData} />
          </div>
        </div>
      )}

      {/* ── Tab: Trends ── */}
      {activeTab === 'trends' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Rating Trend Across Cycles</h3>
            <CycleTrendChart data={trendData} />
          </div>
          <div className="glass p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Completion Trend</h3>
            <CompletionTrendChart data={completionData} />
          </div>
        </div>
      )}

      {/* ── Tab: Departments ── */}
      {activeTab === 'departments' && (
        <div className="space-y-6">
          <div className="glass p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Department Rating Heatmap — {selectedCycle?.cycleName}
            </h3>
            {deptHeatmapData.length > 0 ? (
              <DeptHeatmapChart data={deptHeatmapData} />
            ) : (
              <p className="text-xs text-muted-foreground italic">No department data for this cycle.</p>
            )}
          </div>

          {/* Dept table */}
          {deptData.length > 0 && (
            <div className="glass overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="p-3 text-left text-muted-foreground">Department</th>
                    <th className="p-3 text-right text-muted-foreground">Employees</th>
                    {TIER_ORDER.map(t => (
                      <th key={t} className="p-3 text-right text-muted-foreground">{t}</th>
                    ))}
                    <th className="p-3 text-right text-muted-foreground">Total Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {deptData.map(d => (
                    <tr key={d.departmentName} className="border-b border-border">
                      <td className="p-3 font-medium">{d.departmentName}</td>
                      <td className="p-3 text-right text-muted-foreground">{d.employeeCount}</td>
                      {TIER_ORDER.map(t => (
                        <td key={t} className="p-3 text-right">
                          <span className={`inline-flex min-w-[1.5rem] justify-center rounded-full px-1.5 py-0.5 text-xs font-medium ${
                            (d.ratingDist[t] ?? 0) > 0 ? RATING_BADGE[t] : 'text-muted-foreground'
                          }`}>
                            {d.ratingDist[t] ?? 0}
                          </span>
                        </td>
                      ))}
                      <td className="p-3 text-right text-muted-foreground tabular-nums">
                        ₹{d.totalPayout.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Payouts ── */}
      {activeTab === 'payouts' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Payout by Department — {selectedCycle?.cycleName}
            </h3>
            <PayoutPieChart data={payoutPieData} />
          </div>
          <div className="glass p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Payout Summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Payout</span>
                <span className="text-lg font-bold tabular-nums">₹{(selectedCycle?.totalPayout ?? 0).toLocaleString('en-IN')}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Avg Multiplier</span>
                <span className="text-lg font-bold tabular-nums">x{(selectedCycle?.avgMultiplier ?? 0).toFixed(3)}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Employees Rated</span>
                <span className="text-lg font-bold tabular-nums">{selectedCycle?.totalRated ?? 0}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Exited (Prorated)</span>
                <span className="text-lg font-bold tabular-nums">{selectedCycle?.exitedCount ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Employees ── */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Employee Detail — {selectedCycle?.cycleName}
            </h3>
            <button
              onClick={exportEmployeeCsv}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <FileDown className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>

          <div className="glass overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="p-3 text-left text-muted-foreground">Employee</th>
                  <th className="p-3 text-left text-muted-foreground">Department</th>
                  <th className="p-3 text-left text-muted-foreground">Self</th>
                  <th className="p-3 text-left text-muted-foreground">Manager</th>
                  <th className="p-3 text-left text-muted-foreground">Final</th>
                  <th className="p-3 text-right text-muted-foreground">Variable Pay</th>
                  <th className="p-3 text-right text-muted-foreground">Multiplier</th>
                  <th className="p-3 text-right text-muted-foreground">Payout</th>
                  <th className="p-3 text-left text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {empData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-muted-foreground">No employee data for this cycle.</td>
                  </tr>
                ) : (
                  empData.map((e, i) => (
                    <tr key={i} className={`border-b border-border ${e.isExitFrozen ? 'opacity-70' : ''}`}>
                      <td className="p-3 font-medium">{e.employeeName}</td>
                      <td className="p-3 text-muted-foreground">{e.department}</td>
                      <td className="p-3">
                        {e.selfRating ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RATING_BADGE[e.selfRating] ?? ''}`}>{e.selfRating}</span>
                        ) : '—'}
                      </td>
                      <td className="p-3">
                        {e.managerRating ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RATING_BADGE[e.managerRating] ?? ''}`}>{e.managerRating}</span>
                        ) : '—'}
                      </td>
                      <td className="p-3">
                        {e.finalRating ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${RATING_BADGE[e.finalRating] ?? ''}`}>{e.finalRating}</span>
                        ) : '—'}
                      </td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">₹{e.variablePay.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">x{e.multiplier.toFixed(3)}</td>
                      <td className="p-3 text-right tabular-nums font-medium">₹{e.payoutAmount.toLocaleString('en-IN')}</td>
                      <td className="p-3">
                        {e.isExitFrozen ? (
                          <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                            Exited{e.prorationFactor != null ? ` (${(e.prorationFactor * 100).toFixed(0)}%)` : ''}
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">Active</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {empData.length > 0 && (
                <tfoot>
                  <tr className="border-t border-border font-semibold bg-muted/30">
                    <td colSpan={5} className="p-3 text-right text-sm text-muted-foreground">Totals</td>
                    <td className="p-3 text-right tabular-nums text-sm">₹{empData.reduce((s, e) => s + e.variablePay, 0).toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right tabular-nums text-sm text-muted-foreground">
                      x{(empData.reduce((s, e) => s + e.multiplier, 0) / Math.max(empData.length, 1)).toFixed(3)}
                    </td>
                    <td className="p-3 text-right tabular-nums text-sm">₹{empData.reduce((s, e) => s + e.payoutAmount, 0).toLocaleString('en-IN')}</td>
                    <td className="p-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
