'use client'

import { useState, useMemo } from 'react'
import { downloadCsv } from '@/lib/csv-export'
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import { EmptyState } from '@/components/empty-state'
import {
  BarChart3, TrendingUp, Users2, FileDown, Grid3X3,
} from 'lucide-react'
import type {
  CompetencyGapRow, CompetencyMeta, CompetencyGapStats, CompetencyTrendPoint,
} from '@/lib/db/competency-gaps'

/* ── Constants ── */

const LINE_COLORS = [
  '#818cf8', '#34d399', '#f472b6', '#facc15', '#60a5fa',
  '#fb923c', '#a78bfa', '#22d3ee', '#f87171', '#4ade80',
]

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#e2e8f0',
  },
  labelStyle: { color: '#94a3b8', fontWeight: 600, marginBottom: 4 },
}

/* ── Color helper ── */

function ratingColor(rating: number): string {
  if (rating >= 4) return 'bg-emerald-500/70 text-white'
  if (rating >= 3) return 'bg-amber-500/70 text-white'
  return 'bg-red-500/70 text-white'
}

/* ── Types ── */

type Tab = 'overview' | 'heatmap' | 'trends' | 'employees'

interface CompetencyGapDashboardProps {
  role: 'admin' | 'hrbp' | 'manager'
  rows: CompetencyGapRow[]
  stats: CompetencyGapStats
  trends: CompetencyTrendPoint[]
  cycles: Array<{ id: string; name: string }>
  selectedCycleId: string
  departments: string[]
}

/* ── Main Component ── */

export function CompetencyGapDashboard({
  role, rows, stats, trends, cycles, selectedCycleId, departments,
}: CompetencyGapDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [deptFilter, setDeptFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<string>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const isManager = role === 'manager'

  /* ── Derived data ── */

  const categories = useMemo(
    () => Array.from(new Set(stats.competencies.map(c => c.category))).sort(),
    [stats.competencies],
  )

  const filteredCompetencies = useMemo(
    () => categoryFilter === 'all'
      ? stats.competencies
      : stats.competencies.filter(c => c.category === categoryFilter),
    [stats.competencies, categoryFilter],
  )

  const filteredRows = useMemo(
    () => deptFilter === 'all' ? rows : rows.filter(r => r.department === deptFilter),
    [rows, deptFilter],
  )

  /* ── Sorting (employees tab) ── */

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let valA: number | string | null = null
      let valB: number | string | null = null

      if (sortKey === 'name') { valA = a.employeeName; valB = b.employeeName }
      else if (sortKey === 'department') { valA = a.department; valB = b.department }
      else {
        // sortKey is a competency id
        valA = a.competencyScores[sortKey] ?? null
        valB = b.competencyScores[sortKey] ?? null
      }

      if (valA == null && valB == null) return 0
      if (valA == null) return 1
      if (valB == null) return -1

      const cmp = typeof valA === 'string'
        ? valA.localeCompare(valB as string)
        : (valA as number) - (valB as number)

      return sortDir === 'desc' ? -cmp : cmp
    })
  }, [filteredRows, sortKey, sortDir])

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const SortHeader = ({ label, field, className = '' }: { label: string; field: string; className?: string }) => (
    <th
      className={`p-3 cursor-pointer select-none text-muted-foreground hover:text-foreground transition-colors ${className}`}
      onClick={() => toggleSort(field)}
    >
      {label}
      {sortKey === field && <span className="ml-1 text-[10px]">{sortDir === 'desc' ? '▼' : '▲'}</span>}
    </th>
  )

  /* ── Radar chart data ── */

  const radarData = useMemo(
    () => filteredCompetencies.map(c => ({
      name: c.name,
      value: stats.overallAvg[c.id] ?? 0,
    })),
    [filteredCompetencies, stats.overallAvg],
  )

  /* ── Heatmap data ── */

  const heatmapRows = useMemo(() => {
    if (isManager) {
      // Rows = employees
      return filteredRows.map(r => ({
        label: r.employeeName,
        scores: filteredCompetencies.map(c => r.competencyScores[c.id] ?? null),
      }))
    }
    // Rows = departments
    const deptNames = deptFilter === 'all' ? departments : [deptFilter]
    return deptNames.map(d => ({
      label: d,
      scores: filteredCompetencies.map(c => stats.deptAvg[d]?.[c.id] ?? null),
    }))
  }, [isManager, filteredRows, filteredCompetencies, departments, deptFilter, stats.deptAvg])

  /* ── Trends chart data ── */

  const trendsData = useMemo(
    () => trends.map(t => {
      const point: Record<string, string | number> = { cycleName: t.cycleName }
      for (const c of filteredCompetencies) {
        point[c.name] = t.averages[c.id] ?? 0
      }
      return point
    }),
    [trends, filteredCompetencies],
  )

  /* ── CSV export ── */

  function handleExport() {
    if (filteredRows.length === 0) return
    const csvRows = filteredRows.map(r => {
      const row: Record<string, string | number> = { Employee: r.employeeName, Department: r.department }
      for (const c of filteredCompetencies) row[c.name] = r.competencyScores[c.id] ?? ''
      return row
    })
    downloadCsv(csvRows, `competency-gaps-${selectedCycleId}.csv`)
  }

  /* ── Tabs definition ── */

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'heatmap', label: 'Heatmap', icon: Grid3X3 },
    { key: 'trends', label: 'Trends', icon: TrendingUp },
    { key: 'employees', label: 'Employees', icon: Users2 },
  ]

  /* ── Empty state ── */

  if (rows.length === 0 && stats.competencies.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title="No Competency Data"
          description="No competency ratings found for this cycle. Ensure reviews with competency-linked questions have been completed."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-indigo-400" />
            Competency Gaps
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isManager ? 'Your team\'s competency assessment' : 'Organisation-wide competency analysis'}
          </p>
        </div>

        {/* Filters */}
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
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          <FileDown className="h-3.5 w-3.5" />
          Export CSV
        </button>
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

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                label: 'Overall Avg',
                value: stats.overallScore ? `${stats.overallScore.toFixed(2)} / 5` : '—',
              },
              {
                label: 'Weakest Competency',
                value: stats.lowestCompetency
                  ? `${stats.lowestCompetency.name} (${stats.lowestCompetency.avg.toFixed(2)})`
                  : '—',
              },
              {
                label: 'Weakest Department',
                value: stats.lowestDept
                  ? `${stats.lowestDept.name} (${stats.lowestDept.avg.toFixed(2)})`
                  : '—',
              },
            ].map((card, i) => (
              <div
                key={card.label}
                className="glass glass-accent p-4 text-center"
                style={{ animation: 'countUp 0.5s ease-out both', animationDelay: `${i * 0.08}s` }}
              >
                <p className="text-lg font-extrabold tabular-nums">{card.value}</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Radar chart */}
          <div className="glass p-5 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Competency Radar
            </h3>
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={340}>
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis
                    dataKey="name"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 5]}
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickCount={6}
                  />
                  <Radar
                    name="Avg Rating"
                    dataKey="value"
                    stroke="#818cf8"
                    fill="#818cf8"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                  <Tooltip {...TOOLTIP_STYLE} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground italic">No competency data to display.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Heatmap Tab ── */}
      {activeTab === 'heatmap' && (
        <div className="glass overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="p-3 text-left text-muted-foreground sticky left-0 bg-muted/30 z-10 min-w-[160px]">
                  {isManager ? 'Employee' : 'Department'}
                </th>
                {filteredCompetencies.map(c => (
                  <th key={c.id} className="p-3 text-center text-muted-foreground min-w-[100px]">
                    <span className="block text-xs">{c.name}</span>
                    <span className="block text-[10px] text-muted-foreground/60">{c.category}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapRows.length === 0 ? (
                <tr>
                  <td colSpan={filteredCompetencies.length + 1} className="p-6 text-center text-muted-foreground">
                    No data available.
                  </td>
                </tr>
              ) : (
                heatmapRows.map(row => (
                  <tr key={row.label} className="border-b border-border">
                    <td className="p-3 font-medium sticky left-0 bg-background z-10">
                      {row.label}
                    </td>
                    {row.scores.map((score, i) => (
                      <td key={filteredCompetencies[i].id} className="p-3 text-center">
                        {score != null ? (
                          <span className={`inline-flex min-w-[2.5rem] justify-center rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${ratingColor(score)}`}>
                            {score.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Trends Tab ── */}
      {activeTab === 'trends' && (
        <div className="glass p-5 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Competency Trends Across Cycles
          </h3>
          {trends.length >= 2 ? (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trendsData} margin={{ left: 10, right: 30, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="cycleName"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 5]}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickCount={6}
                />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {filteredCompetencies.map((c, i) => (
                  <Line
                    key={c.id}
                    type="monotone"
                    dataKey={c.name}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 4, strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground italic">Need at least 2 published cycles for trend data.</p>
          )}
        </div>
      )}

      {/* ── Employees Tab ── */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {filteredRows.length} employee{filteredRows.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="glass overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <SortHeader label="Employee" field="name" className="text-left sticky left-0 bg-muted/30 z-10 min-w-[160px]" />
                  <SortHeader label="Department" field="department" className="text-left" />
                  {filteredCompetencies.map(c => (
                    <SortHeader key={c.id} label={c.name} field={c.id} className="text-center min-w-[90px]" />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={filteredCompetencies.length + 2} className="p-6 text-center text-muted-foreground">
                      No employees match the current filters.
                    </td>
                  </tr>
                ) : (
                  sortedRows.map(emp => (
                    <tr key={emp.employeeId} className="border-b border-border table-row-hover">
                      <td className="p-3 font-medium sticky left-0 bg-background z-10">
                        {emp.employeeName}
                      </td>
                      <td className="p-3 text-muted-foreground">{emp.department}</td>
                      {filteredCompetencies.map(c => {
                        const score = emp.competencyScores[c.id]
                        return (
                          <td key={c.id} className="p-3 text-center">
                            {score != null ? (
                              <span className={`inline-flex min-w-[2.5rem] justify-center rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${ratingColor(score)}`}>
                                {score.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Header ── */

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <BarChart3 className="h-6 w-6 text-indigo-400" />
        Competency Gaps
      </h1>
      <p className="text-sm text-muted-foreground mt-1">
        Analyse competency ratings across the organisation
      </p>
    </div>
  )
}
