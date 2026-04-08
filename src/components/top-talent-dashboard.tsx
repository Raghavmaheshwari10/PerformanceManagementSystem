'use client'

import { useState, useActionState } from 'react'
import { downloadCsv } from '@/lib/csv-export'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import {
  RatingDistributionChart,
  CycleTrendChart,
  DeptHeatmapChart,
} from '@/components/report-charts'
import type { RatingDistData, DeptHeatmapData } from '@/components/report-charts'
import { EmptyState } from '@/components/empty-state'
import {
  Star, FileDown, TrendingUp, BarChart3, Users2, Settings,
  ArrowUp, ArrowDown, Minus, Trophy, Medal, Award, Crown,
} from 'lucide-react'
import type { TopTalentEmployee, TopTalentStats } from '@/lib/db/top-talent'
import type { TopTalentConfig } from '@prisma/client'
import { saveTopTalentConfig } from '@/app/(dashboard)/admin/top-talent/actions'

/* ── Constants ── */

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

type Tab = 'overview' | 'departments' | 'trends' | 'employees' | 'settings'

interface TopTalentDashboardProps {
  role: 'admin' | 'hrbp' | 'manager'
  pool: TopTalentEmployee[]
  stats: TopTalentStats
  config: TopTalentConfig
  cycles: Array<{ id: string; name: string }>
  selectedCycleId: string
}

/* ── Trend Icon ── */

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'same' | null }) {
  if (trend === 'up') return <ArrowUp className="h-3.5 w-3.5 text-emerald-400" />
  if (trend === 'down') return <ArrowDown className="h-3.5 w-3.5 text-red-400" />
  if (trend === 'same') return <Minus className="h-3.5 w-3.5 text-slate-400" />
  return <span className="text-[10px] text-muted-foreground">—</span>
}

/* ── Rank Icon (Top 3) ── */

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-yellow-400" />
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-300" />
  if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />
  return <span className="text-sm font-bold text-muted-foreground tabular-nums">{rank}</span>
}

export function TopTalentDashboard({
  role, pool, stats, config, cycles, selectedCycleId,
}: TopTalentDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [sortKey, setSortKey] = useState<string>('compositeScore')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [deptFilter, setDeptFilter] = useState<string>('all')
  const [tierFilter, setTierFilter] = useState<string>('all')

  const isAdmin = role === 'admin'
  const isManager = role === 'manager'
  const showPayout = !isManager

  /* ── Filtering ── */

  const filteredPool = pool.filter(emp => {
    if (deptFilter !== 'all' && emp.department !== deptFilter) return false
    if (tierFilter !== 'all' && emp.currentCycle.finalRating !== tierFilter) return false
    return true
  })

  /* ── Sorting ── */

  const sortedPool = [...filteredPool].sort((a, b) => {
    let valA: number | string | null = null
    let valB: number | string | null = null

    switch (sortKey) {
      case 'name': valA = a.fullName; valB = b.fullName; break
      case 'department': valA = a.department; valB = b.department; break
      case 'finalRating': valA = a.currentCycle.finalRating; valB = b.currentCycle.finalRating; break
      case 'compositeScore': valA = a.currentCycle.compositeScore; valB = b.currentCycle.compositeScore; break
      case 'misScore': valA = a.currentCycle.misScore; valB = b.currentCycle.misScore; break
      case 'goalCompletion': valA = a.goalCompletion; valB = b.goalCompletion; break
      case 'competencyAvg': valA = a.competencyAvg; valB = b.competencyAvg; break
      case 'peerReviewAvg': valA = a.peerReviewAvg; valB = b.peerReviewAvg; break
      case 'feedbackCount': valA = a.feedbackCount; valB = b.feedbackCount; break
      case 'consecutiveHighCycles': valA = a.consecutiveHighCycles; valB = b.consecutiveHighCycles; break
      default: valA = a.currentCycle.compositeScore; valB = b.currentCycle.compositeScore
    }

    if (valA == null && valB == null) return 0
    if (valA == null) return 1
    if (valB == null) return -1

    const cmp = typeof valA === 'string'
      ? valA.localeCompare(valB as string)
      : (valA as number) - (valB as number)

    return sortDir === 'desc' ? -cmp : cmp
  })

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const SortHeader = ({ label, field, align = 'left' }: { label: string; field: string; align?: string }) => (
    <th
      className={`p-3 cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => toggleSort(field)}
    >
      {label}
      {sortKey === field && <span className="ml-1 text-[10px]">{sortDir === 'desc' ? '▼' : '▲'}</span>}
    </th>
  )

  /* ── Departments list ── */

  const departments = Array.from(new Set(pool.map(e => e.department))).sort()

  /* ── Chart data ── */

  // Bell curve / rating distribution
  const ratingDistData: RatingDistData[] = TIER_ORDER.map(t => ({
    tier: t,
    label: TIER_LABELS[t],
    count: stats.byTier[t] ?? 0,
  }))

  // Department heatmap
  const deptHeatmapData: DeptHeatmapData[] = stats.byDepartment.map(d => {
    const deptEmployees = pool.filter(e => e.department === d.department)
    const tierCounts: Record<string, number> = {}
    for (const t of TIER_ORDER) tierCounts[t] = 0
    for (const e of deptEmployees) {
      tierCounts[e.currentCycle.finalRating] = (tierCounts[e.currentCycle.finalRating] ?? 0) + 1
    }
    return { department: d.department, ...tierCounts } as DeptHeatmapData
  })

  // Pool over time for trend chart
  const poolTrendData = stats.poolOverTime.map(p => ({
    cycleName: p.cycleName,
    FEE: 0, EE: 0, ME: 0, SME: 0, BE: 0,
    'Top Talent': p.count,
  }))

  /* ── Top 10 Leaderboard ── */

  const top10 = pool.slice(0, 10)

  /* ── Export ── */

  function handleExportCsv() {
    if (filteredPool.length === 0) return
    downloadCsv(
      filteredPool.map(e => ({
        Name: e.fullName,
        Email: e.email,
        Department: e.department,
        Designation: e.designation ?? '',
        'Final Rating': e.currentCycle.finalRating,
        'Composite Score': e.currentCycle.compositeScore ?? '',
        'MIS Score': e.currentCycle.misScore ?? '',
        'Goal Completion %': e.goalCompletion,
        'Competency Avg': e.competencyAvg ?? '',
        'Peer Review Avg': e.peerReviewAvg ?? '',
        'Feedback Count': e.feedbackCount,
        Trend: e.trend ?? '',
        'Consecutive High Cycles': e.consecutiveHighCycles,
        ...(showPayout ? { Payout: e.currentCycle.payoutAmount } : {}),
      })),
      `top-talent-${selectedCycleId}.csv`
    )
  }

  /* ── Tabs ── */

  const TABS: { key: Tab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'departments', label: 'By Department', icon: Users2 },
    { key: 'trends', label: 'Trends', icon: TrendingUp },
    { key: 'employees', label: 'Employees', icon: Star },
    { key: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
  ]

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin)

  /* ── No data state ── */

  if (pool.length === 0 && activeTab !== ('settings' as Tab)) {
    return (
      <div className="space-y-6">
        <Header role={role} />
        {isAdmin && (
          <TabNav tabs={visibleTabs} activeTab={activeTab} setActiveTab={setActiveTab} />
        )}
        <EmptyState
          icon={<Trophy className="h-6 w-6" />}
          title="No Top Talent Found"
          description="No employees match the current top talent criteria. Try adjusting the configuration or wait for a published cycle."
          {...(isAdmin ? { action: { label: 'Configure Criteria', onClick: () => setActiveTab('settings') } } : {})}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Header role={role} />

      {/* Tab Navigation */}
      <TabNav tabs={visibleTabs} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Top Talent', value: stats.total },
              { label: '% of Org', value: `${stats.percentOfOrg}%` },
              { label: 'Avg Score', value: stats.avgScore },
              { label: 'Top Department', value: stats.topDepartment ?? '—' },
            ].map((card, i) => (
              <div
                key={card.label}
                className="glass glass-accent p-4 text-center"
                style={{ animation: 'countUp 0.5s ease-out both', animationDelay: `${i * 0.08}s` }}
              >
                <p className="text-2xl font-extrabold tabular-nums">{card.value}</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Top 10 Leaderboard */}
          <div className="glass p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-400" />
              Top 10 {isManager ? 'Team ' : ''}Leaderboard
            </h3>
            <div className="space-y-2">
              {top10.map((emp, i) => {
                const rank = i + 1
                const isTop3 = rank <= 3
                return (
                  <div
                    key={emp.id}
                    className={`flex items-center gap-4 rounded-lg px-4 py-3 transition-colors ${
                      isTop3 ? 'glass-interactive border border-white/[0.06]' : 'hover:bg-muted/20'
                    }`}
                  >
                    <div className="flex items-center justify-center w-8">
                      <RankBadge rank={rank} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{emp.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{emp.department}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${RATING_BADGE[emp.currentCycle.finalRating] ?? ''}`}>
                      {emp.currentCycle.finalRating}
                    </span>
                    <div className="text-right min-w-[60px]">
                      <p className="text-sm font-bold tabular-nums">{emp.currentCycle.compositeScore ?? '—'}</p>
                      <p className="text-[10px] text-muted-foreground">score</p>
                    </div>
                    <TrendIcon trend={emp.trend} />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bell Curve */}
          <div className="glass p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Rating Distribution</h3>
            <RatingDistributionChart data={ratingDistData} />
          </div>
        </div>
      )}

      {/* ── Departments Tab ── */}
      {activeTab === 'departments' && (
        <div className="space-y-6">
          <div className="glass p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Top Talent by Department
            </h3>
            {deptHeatmapData.length > 0 ? (
              <DeptHeatmapChart data={deptHeatmapData} />
            ) : (
              <p className="text-xs text-muted-foreground italic">No department data.</p>
            )}
          </div>

          {/* Department breakdown table */}
          {stats.byDepartment.length > 0 && (
            <div className="glass overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="p-3 text-left text-muted-foreground">Department</th>
                    <th className="p-3 text-right text-muted-foreground">Top Talent</th>
                    <th className="p-3 text-right text-muted-foreground">% of Pool</th>
                    {TIER_ORDER.map(t => (
                      <th key={t} className="p-3 text-right text-muted-foreground">{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.byDepartment.map(d => {
                    const deptEmps = pool.filter(e => e.department === d.department)
                    return (
                      <tr key={d.department} className="border-b border-border">
                        <td className="p-3 font-medium">{d.department}</td>
                        <td className="p-3 text-right text-muted-foreground tabular-nums">{d.count}</td>
                        <td className="p-3 text-right text-muted-foreground tabular-nums">{d.percentage}%</td>
                        {TIER_ORDER.map(t => {
                          const count = deptEmps.filter(e => e.currentCycle.finalRating === t).length
                          return (
                            <td key={t} className="p-3 text-right">
                              <span className={`inline-flex min-w-[1.5rem] justify-center rounded-full px-1.5 py-0.5 text-xs font-medium ${
                                count > 0 ? RATING_BADGE[t] : 'text-muted-foreground'
                              }`}>
                                {count}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Trends Tab ── */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          {/* Pool size line chart */}
          <div className="glass p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Top Talent Pool Size Over Cycles
            </h3>
            {stats.poolOverTime.length >= 2 ? (
              <PoolTrendChart data={stats.poolOverTime} />
            ) : (
              <p className="text-xs text-muted-foreground italic">Need at least 2 published cycles for trend data.</p>
            )}
          </div>

          {/* Movement table: who entered/exited the pool */}
          <div className="glass p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Pool Composition
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-emerald-500/10">
                <p className="text-xl font-bold text-emerald-400 tabular-nums">
                  {pool.filter(e => e.trend === 'up').length}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase">Trending Up</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-500/10">
                <p className="text-xl font-bold text-blue-400 tabular-nums">
                  {pool.filter(e => e.trend === 'same').length}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase">Stable</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-500/10">
                <p className="text-xl font-bold text-red-400 tabular-nums">
                  {pool.filter(e => e.trend === 'down').length}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase">Trending Down</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Employees Tab ── */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          {/* Filters + export */}
          <div className="flex flex-wrap items-center gap-3">
            {!isManager && (
              <select
                className="glass appearance-none rounded-lg border border-border bg-muted/30 px-3 py-1.5 pr-8 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
              >
                <option value="all">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
            <select
              className="glass appearance-none rounded-lg border border-border bg-muted/30 px-3 py-1.5 pr-8 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              value={tierFilter}
              onChange={e => setTierFilter(e.target.value)}
            >
              <option value="all">All Tiers</option>
              {TIER_ORDER.map(t => <option key={t} value={t}>{t} — {TIER_LABELS[t]}</option>)}
            </select>
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground">
              {filteredPool.length} employee{filteredPool.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <FileDown className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>

          {/* Table */}
          <div className="glass overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <SortHeader label="Name" field="name" />
                  {!isManager && <SortHeader label="Department" field="department" />}
                  <th className="p-3 text-left text-muted-foreground">Designation</th>
                  <SortHeader label="Rating" field="finalRating" />
                  <th className="p-3 text-center text-muted-foreground">Trend</th>
                  <SortHeader label="Score" field="compositeScore" align="right" />
                  <SortHeader label="MIS" field="misScore" align="right" />
                  <SortHeader label="Goals %" field="goalCompletion" align="right" />
                  <SortHeader label="Competency" field="competencyAvg" align="right" />
                  <SortHeader label="Peer Avg" field="peerReviewAvg" align="right" />
                  <SortHeader label="Feedback" field="feedbackCount" align="right" />
                  <SortHeader label="Streak" field="consecutiveHighCycles" align="right" />
                  {showPayout && <th className="p-3 text-right text-muted-foreground">Payout</th>}
                </tr>
              </thead>
              <tbody>
                {sortedPool.length === 0 ? (
                  <tr>
                    <td colSpan={isManager ? 11 : (showPayout ? 13 : 12)} className="p-6 text-center text-muted-foreground">
                      No employees match the current filters.
                    </td>
                  </tr>
                ) : (
                  sortedPool.map(emp => (
                    <tr key={emp.id} className="border-b border-border table-row-hover">
                      <td className="p-3 font-medium">{emp.fullName}</td>
                      {!isManager && <td className="p-3 text-muted-foreground">{emp.department}</td>}
                      <td className="p-3 text-muted-foreground text-xs">{emp.designation ?? '—'}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${RATING_BADGE[emp.currentCycle.finalRating] ?? ''}`}>
                          {emp.currentCycle.finalRating}
                        </span>
                      </td>
                      <td className="p-3 text-center"><TrendIcon trend={emp.trend} /></td>
                      <td className="p-3 text-right tabular-nums font-medium">{emp.currentCycle.compositeScore ?? '—'}</td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">{emp.currentCycle.misScore ?? '—'}</td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">{emp.goalCompletion}%</td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">{emp.competencyAvg ?? '—'}</td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">{emp.peerReviewAvg ?? '—'}</td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">{emp.feedbackCount}</td>
                      <td className="p-3 text-right tabular-nums">
                        <span className={emp.consecutiveHighCycles >= 3 ? 'text-emerald-400 font-semibold' : 'text-muted-foreground'}>
                          {emp.consecutiveHighCycles}
                        </span>
                      </td>
                      {showPayout && (
                        <td className="p-3 text-right tabular-nums font-medium">
                          ₹{emp.currentCycle.payoutAmount.toLocaleString('en-IN')}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Settings Tab (Admin only) ── */}
      {activeTab === 'settings' && isAdmin && (
        <SettingsTab config={config} />
      )}
    </div>
  )
}

/* ── Settings Tab Component ── */

function SettingsTab({ config }: { config: TopTalentConfig }) {
  const [submitted, setSubmitted] = useState(false)
  const [state, formAction, isPending] = useActionState(
    async (prev: any, formData: FormData) => {
      setSubmitted(true)
      return saveTopTalentConfig(prev, formData)
    },
    { data: null, error: null }
  )

  return (
    <div className="glass p-6 max-w-lg space-y-6">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Top Talent Configuration</h3>
        <p className="text-xs text-muted-foreground mt-1">Define what qualifies an employee as top talent.</p>
      </div>

      <form action={formAction} className="space-y-5">
        {/* Rating Tiers */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Qualifying Rating Tiers</label>
          <div className="flex flex-wrap gap-2">
            {TIER_ORDER.map(tier => (
              <label key={tier} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/20 transition-colors has-[:checked]:border-indigo-500/50 has-[:checked]:bg-indigo-500/10">
                <input
                  type="checkbox"
                  name="rating_tiers"
                  value={tier}
                  defaultChecked={config.rating_tiers.includes(tier)}
                  className="rounded border-border text-indigo-500 focus:ring-indigo-500/30"
                />
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${RATING_BADGE[tier]}`}>{tier}</span>
                <span className="text-muted-foreground text-xs">{TIER_LABELS[tier]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Min Consecutive Cycles */}
        <div className="space-y-1">
          <label htmlFor="min_cycles" className="text-sm font-medium">Min Consecutive High-Rated Cycles</label>
          <input
            id="min_cycles"
            name="min_cycles"
            type="number"
            min={1}
            max={10}
            defaultValue={config.min_cycles}
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {/* Score Threshold */}
        <div className="space-y-1">
          <label htmlFor="score_threshold" className="text-sm font-medium">Min Composite Score (0 = no threshold)</label>
          <input
            id="score_threshold"
            name="score_threshold"
            type="number"
            min={0}
            max={100}
            defaultValue={config.score_threshold}
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {/* MIS Threshold */}
        <div className="space-y-1">
          <label htmlFor="mis_threshold" className="text-sm font-medium">Min MIS Score (0 = no threshold)</label>
          <input
            id="mis_threshold"
            name="mis_threshold"
            type="number"
            min={0}
            max={100}
            defaultValue={config.mis_threshold}
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-medium text-white shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Save Configuration'}
          </button>
          {state.error && <p className="text-sm text-red-400">{state.error}</p>}
          {submitted && !state.error && !isPending && (
            <p className="text-sm text-emerald-400 opacity-0 animate-[fadeIn_0.3s_ease-out_forwards]">Saved!</p>
          )}
        </div>
      </form>
    </div>
  )
}

/* ── Pool Trend Mini Chart (uses recharts directly) ── */

function PoolTrendChart({ data }: { data: Array<{ cycleName: string; count: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ left: 10, right: 30, top: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="cycleName" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#e2e8f0',
          }}
          labelStyle={{ color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}
        />
        <Line
          type="monotone"
          dataKey="count"
          name="Pool Size"
          stroke="#818cf8"
          strokeWidth={2}
          dot={{ r: 5, fill: '#818cf8', strokeWidth: 2, stroke: '#1e1b4b' }}
          activeDot={{ r: 7 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

/* ── Shared Sub-components ── */

function Header({ role }: { role: string }) {
  return (
    <div>
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Star className="h-6 w-6 text-yellow-400" />
        Top Talent
      </h1>
      <p className="text-sm text-muted-foreground mt-1">
        {role === 'manager' ? 'Your team\'s top performers' : 'Organisation-wide talent pool'}
      </p>
    </div>
  )
}

function TabNav({
  tabs, activeTab, setActiveTab,
}: {
  tabs: { key: Tab; label: string; icon: React.ElementType }[]
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted/30 p-1 overflow-x-auto">
      {tabs.map(tab => {
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
  )
}
