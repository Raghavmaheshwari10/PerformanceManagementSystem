'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, History, Settings2, Plus, Search, FileDown } from 'lucide-react'
import type { PipListItem, PipStats, PipRecommendation } from '@/lib/db/pip'

/* ── Types ── */

interface PipDashboardProps {
  pips: PipListItem[]
  stats: PipStats
  recommendations: PipRecommendation[]
  role: 'admin' | 'hrbp' | 'manager'
  title: string
  subtitle?: string
}

/* ── Constants ── */

const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-slate-500/20 text-slate-400',
  active:    'bg-blue-500/20 text-blue-400',
  extended:  'bg-amber-500/20 text-amber-400',
  completed: 'bg-emerald-500/20 text-emerald-400',
  closed:    'bg-gray-500/20 text-gray-400',
}

const OUTCOME_BADGE: Record<string, string> = {
  improved:           'bg-emerald-500/20 text-emerald-400',
  partially_improved: 'bg-amber-500/20 text-amber-400',
  not_improved:       'bg-red-500/20 text-red-400',
}

const RATING_BADGE: Record<string, string> = {
  FEE: 'bg-emerald-500/20 text-emerald-400',
  EE:  'bg-green-500/20 text-green-400',
  ME:  'bg-blue-500/20 text-blue-400',
  SME: 'bg-amber-500/20 text-amber-400',
  BE:  'bg-red-500/20 text-red-400',
}

const ACTIVE_STATUSES = new Set(['draft', 'active', 'extended'])
const HISTORY_STATUSES = new Set(['completed', 'closed'])

type Tab = 'active' | 'history' | 'settings'

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/* ── Component ── */

export function PipDashboard({
  pips,
  stats,
  recommendations,
  role,
  title,
  subtitle,
}: PipDashboardProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('active')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [deptFilter, setDeptFilter] = useState<string>('all')
  const [historySearch, setHistorySearch] = useState('')

  const isAdmin = role === 'admin'

  /* ── Derived data ── */

  const activePips = pips.filter(p => ACTIVE_STATUSES.has(p.status))
  const historyPips = pips.filter(p => HISTORY_STATUSES.has(p.status))

  const departments = Array.from(new Set(pips.map(p => p.department))).sort()

  // Filter active tab
  const filteredActive = activePips.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (deptFilter !== 'all' && p.department !== deptFilter) return false
    return true
  })

  // Filter history tab
  const filteredHistory = historyPips.filter(p => {
    if (historySearch.trim()) {
      return p.employeeName.toLowerCase().includes(historySearch.trim().toLowerCase())
    }
    return true
  })

  // Recommendations without active PIP
  const pendingRecommendations = recommendations.filter(r => !r.hasActivePip)

  // Top department by active count
  const topDept = stats.byDepartment[0]?.department ?? '—'

  // Percent of org: totalActive / totalAll (avoid division by zero)
  const percentOfOrg = stats.totalAll > 0
    ? ((stats.totalActive / stats.totalAll) * 100).toFixed(1)
    : '0'

  /* ── Tabs ── */

  const TABS: { key: Tab; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { key: 'active', label: 'Active PIPs', icon: AlertTriangle },
    { key: 'history', label: 'History', icon: History },
    { key: 'settings', label: 'Settings', icon: Settings2, adminOnly: true },
  ]

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
            {title}
          </h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <a
          href={`/${role}/pip/new`}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
        >
          <Plus className="h-4 w-4" />
          New PIP
        </a>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-lg bg-muted/30 p-1 overflow-x-auto">
        {visibleTabs.map(tab => {
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

      {/* ── Active PIPs Tab ── */}
      {activeTab === 'active' && (
        <div className="space-y-6">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Total Active', value: stats.totalActive },
              { label: '% of Org', value: `${percentOfOrg}%` },
              { label: 'Avg Duration', value: `${stats.avgDurationDays}d` },
              { label: 'By Department', value: topDept },
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

          {/* PIP Recommended Banner */}
          {pendingRecommendations.length > 0 && (
            <div className="glass border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                PIP Recommended ({pendingRecommendations.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {pendingRecommendations.map(rec => (
                  <a
                    key={rec.employeeId}
                    href={`/${role}/pip/new?employeeId=${rec.employeeId}&cycleId=${rec.cycleId}`}
                    className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-sm hover:bg-amber-500/20 transition-colors"
                  >
                    <span className="font-medium">{rec.employeeName}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${RATING_BADGE[rec.finalRating] ?? ''}`}>
                      {rec.finalRating}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="glass appearance-none rounded-lg border border-border bg-muted/30 px-3 py-1.5 pr-8 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="extended">Extended</option>
              <option value="completed">Completed</option>
              <option value="closed">Closed</option>
            </select>
            <select
              className="glass appearance-none rounded-lg border border-border bg-muted/30 px-3 py-1.5 pr-8 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
            >
              <option value="all">All Departments</option>
              {departments.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground">
              {filteredActive.length} PIP{filteredActive.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Active PIPs Table */}
          <div className="glass overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="p-3 text-left text-muted-foreground">Employee</th>
                  <th className="p-3 text-left text-muted-foreground">Department</th>
                  <th className="p-3 text-left text-muted-foreground">Start Date</th>
                  <th className="p-3 text-left text-muted-foreground">End Date</th>
                  <th className="p-3 text-right text-muted-foreground">Days Left</th>
                  <th className="p-3 text-center text-muted-foreground">Milestones</th>
                  <th className="p-3 text-left text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredActive.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      No active PIPs found.
                    </td>
                  </tr>
                ) : (
                  filteredActive.map(pip => (
                    <tr
                      key={pip.id}
                      onClick={() => router.push(`/${role}/pip/${pip.id}`)}
                      className="border-b border-border glass-interactive cursor-pointer"
                    >
                      <td className="p-3 font-medium">{pip.employeeName}</td>
                      <td className="p-3 text-muted-foreground">{pip.department}</td>
                      <td className="p-3 text-muted-foreground tabular-nums">{formatDate(pip.startDate)}</td>
                      <td className="p-3 text-muted-foreground tabular-nums">{formatDate(pip.endDate)}</td>
                      <td className="p-3 text-right tabular-nums">
                        <span className={
                          pip.daysRemaining < 7
                            ? 'text-red-400 font-semibold'
                            : pip.daysRemaining < 14
                              ? 'text-amber-400 font-semibold'
                              : ''
                        }>
                          {pip.daysRemaining}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {pip.milestoneProgress.completed}/{pip.milestoneProgress.total}
                          </span>
                          <div className="h-1.5 w-16 rounded-full bg-muted/50 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500 transition-all"
                              style={{
                                width: pip.milestoneProgress.total > 0
                                  ? `${(pip.milestoneProgress.completed / pip.milestoneProgress.total) * 100}%`
                                  : '0%',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[pip.status] ?? ''}`}>
                          {pip.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── History Tab ── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Search */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search employee..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                className="glass rounded-lg border border-border bg-muted/30 pl-9 pr-3 py-1.5 text-sm backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 w-64"
              />
            </div>
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground">
              {filteredHistory.length} PIP{filteredHistory.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* History Table */}
          <div className="glass overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="p-3 text-left text-muted-foreground">Employee</th>
                  <th className="p-3 text-left text-muted-foreground">Department</th>
                  <th className="p-3 text-left text-muted-foreground">Start Date</th>
                  <th className="p-3 text-left text-muted-foreground">End Date</th>
                  <th className="p-3 text-right text-muted-foreground">Days Left</th>
                  <th className="p-3 text-center text-muted-foreground">Milestones</th>
                  <th className="p-3 text-left text-muted-foreground">Status</th>
                  <th className="p-3 text-left text-muted-foreground">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">
                      No completed or closed PIPs found.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map(pip => (
                    <tr
                      key={pip.id}
                      onClick={() => router.push(`/${role}/pip/${pip.id}`)}
                      className="border-b border-border glass-interactive cursor-pointer"
                    >
                      <td className="p-3 font-medium">{pip.employeeName}</td>
                      <td className="p-3 text-muted-foreground">{pip.department}</td>
                      <td className="p-3 text-muted-foreground tabular-nums">{formatDate(pip.startDate)}</td>
                      <td className="p-3 text-muted-foreground tabular-nums">{formatDate(pip.endDate)}</td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">{pip.daysRemaining}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {pip.milestoneProgress.completed}/{pip.milestoneProgress.total}
                          </span>
                          <div className="h-1.5 w-16 rounded-full bg-muted/50 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500 transition-all"
                              style={{
                                width: pip.milestoneProgress.total > 0
                                  ? `${(pip.milestoneProgress.completed / pip.milestoneProgress.total) * 100}%`
                                  : '0%',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[pip.status] ?? ''}`}>
                          {pip.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {pip.outcome ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${OUTCOME_BADGE[pip.outcome] ?? ''}`}>
                            {pip.outcome.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
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
        <div className="glass p-6 max-w-lg space-y-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">PIP Auto-Suggest Configuration</h3>
            <p className="text-xs text-muted-foreground mt-1">
              The system automatically recommends PIPs for employees based on their performance ratings.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tiers that trigger PIP recommendation</label>
              <div className="flex flex-wrap gap-2">
                {(['FEE', 'EE', 'ME', 'SME', 'BE'] as const).map(tier => {
                  const isChecked = tier === 'SME' || tier === 'BE'
                  return (
                    <label
                      key={tier}
                      className={`flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm ${
                        isChecked ? 'opacity-100' : 'opacity-50'
                      } cursor-default`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        className="rounded border-border text-indigo-500 focus:ring-indigo-500/30"
                      />
                      <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${RATING_BADGE[tier]}`}>
                        {tier}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">
                These settings are informational. Auto-suggest currently recommends PIP for SME and BE rated employees.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
