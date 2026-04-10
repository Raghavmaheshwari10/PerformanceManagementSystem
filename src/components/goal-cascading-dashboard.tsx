'use client'

import { useState, useTransition } from 'react'
import { EmptyState } from '@/components/empty-state'
import {
  Target, ChevronRight, ChevronDown, Plus, Pencil, Trash2,
  Link2, Unlink, AlertCircle,
} from 'lucide-react'
import {
  saveOrgGoal, removeOrgGoal, saveDeptGoal, removeDeptGoal,
  linkKpi, removeKpiLink,
} from '@/app/(dashboard)/admin/goal-cascading/actions'

/* ── Types ── */

interface GoalTreeKpi {
  id: string; title: string; weight: number | null; score: number | null; employeeName: string
}
interface GoalTreeDeptGoal {
  id: string; title: string; description: string | null; department: string; departmentId: string
  creatorName: string; progress: number; kpiCount: number; kpis: GoalTreeKpi[]
}
interface GoalTreeOrgGoal {
  id: string; title: string; description: string | null; cycleName: string | null; cycleId: string | null
  creatorName: string; progress: number; deptGoalCount: number; deptGoals: GoalTreeDeptGoal[]
}
interface GoalCascadingStats {
  totalOrgGoals: number; avgCompletion: number; deptsOnTrack: number; deptsBehind: number; unlinkedKpis: number
}

interface GoalCascadingDashboardProps {
  role: 'admin' | 'hrbp' | 'manager'
  tree: GoalTreeOrgGoal[]
  stats: GoalCascadingStats
  cycles: Array<{ id: string; name: string }>
  departments: Array<{ id: string; name: string }>
  selectedCycleId: string
  unlinkedKpis?: Array<{ id: string; title: string; employeeName: string }>
  availableDeptGoals?: Array<{ id: string; title: string; department: string }>
}

/* ── Progress Bar ── */

function ProgressBar({ value }: { value: number }) {
  const color = value >= 70 ? 'bg-emerald-500' : value >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  )
}

/* ── Org Goal Form (inline, full-width) ── */

function GoalForm({
  open,
  onClose,
  editingGoal,
  cycles,
  selectedCycleId,
  isPending,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  editingGoal: GoalTreeOrgGoal | null
  cycles: Array<{ id: string; name: string }>
  selectedCycleId: string
  isPending: boolean
  onSubmit: (data: { title: string; description?: string; cycleId?: string }) => void
}) {
  const [title, setTitle] = useState(editingGoal?.title ?? '')
  const [description, setDescription] = useState(editingGoal?.description ?? '')
  const [cycleId, setCycleId] = useState(editingGoal?.cycleId ?? selectedCycleId)

  const key = editingGoal?.id ?? 'new'

  if (!open) return null

  return (
    <div className="rounded-lg border border-indigo-200 bg-card p-6 space-y-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {editingGoal ? 'Edit Org Goal' : 'New Org Goal'}
        </h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm font-medium">Title *</label>
          <input
            key={`title-${key}`}
            defaultValue={editingGoal?.title ?? ''}
            onChange={e => setTitle(e.target.value)}
            placeholder="Enter goal title..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            maxLength={200}
            autoFocus
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm font-medium">Description</label>
          <textarea
            key={`desc-${key}`}
            defaultValue={editingGoal?.description ?? ''}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional description..."
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-y"
            maxLength={1000}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Cycle</label>
          <select
            key={`cycle-${key}`}
            defaultValue={editingGoal?.cycleId ?? selectedCycleId}
            onChange={e => setCycleId(e.target.value)}
            className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            <option value="">No cycle</option>
            {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button
          onClick={onClose}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
        >
          Cancel
        </button>
        <button
          disabled={isPending || !title.trim()}
          onClick={() => onSubmit({ title: title.trim(), description: description.trim() || undefined, cycleId: cycleId || undefined })}
          className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-50"
        >
          {isPending ? 'Saving...' : editingGoal ? 'Update' : 'Create'}
        </button>
      </div>
    </div>
  )
}

/* ── Dept Goal Form (inline, full-width) ── */

function DeptGoalForm({
  open,
  onClose,
  orgGoalId,
  departments,
  isPending,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  orgGoalId: string
  departments: Array<{ id: string; name: string }>
  isPending: boolean
  onSubmit: (data: { title: string; description?: string; orgGoalId: string; departmentId: string }) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? '')

  if (!open) return null

  return (
    <div className="rounded-lg border border-indigo-200 bg-card p-6 space-y-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">New Department Goal</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm font-medium">Title *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Enter goal title..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            maxLength={200}
            autoFocus
          />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="text-sm font-medium">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional description..."
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-y"
            maxLength={1000}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Department *</label>
          <select
            value={departmentId}
            onChange={e => setDepartmentId(e.target.value)}
            className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button
          onClick={onClose}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
        >
          Cancel
        </button>
        <button
          disabled={isPending || !title.trim() || !departmentId}
          onClick={() => onSubmit({
            title: title.trim(),
            description: description.trim() || undefined,
            orgGoalId,
            departmentId,
          })}
          className="rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Create'}
        </button>
      </div>
    </div>
  )
}

/* ── Main Component ── */

export function GoalCascadingDashboard({
  role, tree, stats, cycles, departments, selectedCycleId,
  unlinkedKpis, availableDeptGoals,
}: GoalCascadingDashboardProps) {
  const [expandedOrg, setExpandedOrg] = useState<Set<string>>(new Set())
  const [expandedDept, setExpandedDept] = useState<Set<string>>(new Set())
  const [showOrgModal, setShowOrgModal] = useState(false)
  const [showDeptModal, setShowDeptModal] = useState<string | null>(null)
  const [editingOrg, setEditingOrg] = useState<GoalTreeOrgGoal | null>(null)
  const [isPending, startTransition] = useTransition()

  const isAdmin = role === 'admin'
  const isHrbp = role === 'hrbp'
  const isManager = role === 'manager'
  const canCreateDeptGoal = isAdmin || isHrbp

  /* ── Toggle helpers ── */

  function toggleOrg(id: string) {
    setExpandedOrg(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleDept(id: string) {
    setExpandedDept(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  /* ── Action handlers ── */

  function handleSaveOrgGoal(data: { title: string; description?: string; cycleId?: string }) {
    startTransition(async () => {
      const result = await saveOrgGoal(editingOrg?.id ?? null, data)
      if (result.success) {
        setShowOrgModal(false)
        setEditingOrg(null)
      }
    })
  }

  function handleDeleteOrgGoal(id: string) {
    if (!confirm('Delete this org goal and all its department goals?')) return
    startTransition(async () => {
      await removeOrgGoal(id)
    })
  }

  function handleSaveDeptGoal(data: { title: string; description?: string; orgGoalId: string; departmentId: string }) {
    startTransition(async () => {
      const result = await saveDeptGoal(null, data)
      if (result.success) {
        setShowDeptModal(null)
      }
    })
  }

  function handleDeleteDeptGoal(id: string) {
    if (!confirm('Delete this department goal?')) return
    startTransition(async () => {
      await removeDeptGoal(id)
    })
  }

  function handleUnlinkKpi(kpiId: string) {
    startTransition(async () => {
      await removeKpiLink(kpiId)
    })
  }

  function handleLinkKpi(kpiId: string, deptGoalId: string) {
    if (!deptGoalId) return
    startTransition(async () => {
      await linkKpi(kpiId, deptGoalId)
    })
  }

  /* ── Empty state ── */

  if (tree.length === 0 && !isAdmin) {
    return (
      <div className="space-y-6">
        <Header />
        <EmptyState
          icon={<Target className="h-6 w-6" />}
          title="No Goals Configured"
          description="Goal cascading has not been set up for this cycle yet. Check back later or contact your admin."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <Header />
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditingOrg(null); setShowOrgModal(true) }}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
          >
            <Plus className="h-4 w-4" />
            Org Goal
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Org Goals', value: stats.totalOrgGoals, color: '' },
          { label: 'Avg Completion', value: `${stats.avgCompletion}%`, color: '' },
          { label: 'Depts On Track', value: stats.deptsOnTrack, color: 'text-emerald-400' },
          { label: 'Unlinked KPIs', value: stats.unlinkedKpis, color: 'text-amber-400' },
        ].map((card, i) => (
          <div
            key={card.label}
            className="glass glass-accent p-4 text-center"
            style={{ animation: 'countUp 0.5s ease-out both', animationDelay: `${i * 0.08}s` }}
          >
            <p className={`text-2xl font-extrabold tabular-nums ${card.color}`}>{card.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Tree view */}
      <div className="space-y-2">
        {tree.length === 0 && isAdmin && (
          <div className="glass p-8 text-center">
            <Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No org goals yet. Click &quot;Org Goal&quot; above to create one.</p>
          </div>
        )}

        {tree.map(org => {
          const orgExpanded = expandedOrg.has(org.id)

          return (
            <div key={org.id} className="glass overflow-hidden">
              {/* Org Goal Row */}
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                <button onClick={() => toggleOrg(org.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                  {orgExpanded
                    ? <ChevronDown className="h-4 w-4" />
                    : <ChevronRight className="h-4 w-4" />
                  }
                </button>

                <span className="rounded-full bg-indigo-500/20 text-indigo-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  ORG
                </span>

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{org.title}</p>
                  {org.cycleName && (
                    <p className="text-[10px] text-muted-foreground">{org.cycleName}</p>
                  )}
                </div>

                <span className="text-sm font-semibold tabular-nums whitespace-nowrap">{org.progress}%</span>

                <div className="w-24 hidden sm:block">
                  <ProgressBar value={org.progress} />
                </div>

                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {org.deptGoalCount} dept{org.deptGoalCount !== 1 ? 's' : ''}
                </span>

                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditingOrg(org); setShowOrgModal(true) }}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                      title="Edit org goal"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteOrgGoal(org.id)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete org goal"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Expanded: Dept Goals */}
              {orgExpanded && (
                <div className="border-t border-border">
                  {org.deptGoals.map(dept => {
                    const deptExpanded = expandedDept.has(dept.id)

                    return (
                      <div key={dept.id}>
                        {/* Dept Goal Row */}
                        <div className="flex items-center gap-3 px-4 py-2.5 pl-10 hover:bg-muted/20 transition-colors border-t border-border/50 first:border-t-0">
                          <button onClick={() => toggleDept(dept.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                            {deptExpanded
                              ? <ChevronDown className="h-3.5 w-3.5" />
                              : <ChevronRight className="h-3.5 w-3.5" />
                            }
                          </button>

                          <span className="rounded-full bg-violet-500/20 text-violet-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                            DEPT
                          </span>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{dept.title}</p>
                            <p className="text-[10px] text-muted-foreground">{dept.department}</p>
                          </div>

                          <span className="text-xs font-semibold tabular-nums whitespace-nowrap">{dept.progress}%</span>

                          <div className="w-20 hidden sm:block">
                            <ProgressBar value={dept.progress} />
                          </div>

                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {dept.kpiCount} KPI{dept.kpiCount !== 1 ? 's' : ''}
                          </span>

                          {canCreateDeptGoal && (
                            <button
                              onClick={() => handleDeleteDeptGoal(dept.id)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Delete dept goal"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        {/* Expanded: KPI rows */}
                        {deptExpanded && (
                          <div className="border-t border-border/30">
                            {dept.kpis.length === 0 ? (
                              <div className="px-4 py-3 pl-20 text-xs text-muted-foreground italic">
                                No KPIs linked to this department goal.
                              </div>
                            ) : (
                              dept.kpis.map(kpi => (
                                <div key={kpi.id} className="flex items-center gap-3 px-4 py-2 pl-20 hover:bg-muted/10 transition-colors border-t border-border/20">
                                  <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                                    KPI
                                  </span>

                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{kpi.title}</p>
                                    <p className="text-[10px] text-muted-foreground">{kpi.employeeName}</p>
                                  </div>

                                  {kpi.score != null && (
                                    <span className="text-xs tabular-nums font-medium text-muted-foreground">
                                      {kpi.score}/5
                                    </span>
                                  )}

                                  {isManager && (
                                    <button
                                      onClick={() => handleUnlinkKpi(kpi.id)}
                                      className="p-1 rounded-md text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                                      title="Unlink KPI"
                                    >
                                      <Unlink className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Add Department Goal button */}
                  {canCreateDeptGoal && (
                    <button
                      onClick={() => setShowDeptModal(org.id)}
                      className="flex items-center gap-1.5 px-4 py-2.5 pl-10 w-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors border-t border-border/50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Department Goal
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Unlinked KPIs section (manager only) */}
      {isManager && unlinkedKpis && unlinkedKpis.length > 0 && (
        <div className="glass p-5 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {unlinkedKpis.length} Unlinked KPI{unlinkedKpis.length !== 1 ? 's' : ''}
          </h3>
          <p className="text-xs text-muted-foreground">
            These KPIs are not linked to any department goal. Link them to include in the goal cascade.
          </p>
          <div className="space-y-2">
            {unlinkedKpis.map(kpi => (
              <div key={kpi.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/20 transition-colors">
                <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  KPI
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{kpi.title}</p>
                  <p className="text-[10px] text-muted-foreground">{kpi.employeeName}</p>
                </div>

                {availableDeptGoals && availableDeptGoals.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <select
                      defaultValue=""
                      onChange={e => handleLinkKpi(kpi.id, e.target.value)}
                      className="appearance-none rounded-lg border border-border bg-muted/30 px-2 py-1 text-xs backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    >
                      <option value="" disabled>Link to goal...</option>
                      {availableDeptGoals.map(dg => (
                        <option key={dg.id} value={dg.id}>{dg.title} ({dg.department})</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Org Goal Form (inline) */}
      <GoalForm
        key={editingOrg?.id ?? 'new'}
        open={showOrgModal}
        onClose={() => { setShowOrgModal(false); setEditingOrg(null) }}
        editingGoal={editingOrg}
        cycles={cycles}
        selectedCycleId={selectedCycleId}
        isPending={isPending}
        onSubmit={handleSaveOrgGoal}
      />

      {/* Dept Goal Form (inline) */}
      {showDeptModal && (
        <DeptGoalForm
          key={showDeptModal}
          open={!!showDeptModal}
          onClose={() => setShowDeptModal(null)}
          orgGoalId={showDeptModal}
          departments={departments}
          isPending={isPending}
          onSubmit={handleSaveDeptGoal}
        />
      )}
    </div>
  )
}

/* ── Header ── */

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Target className="h-6 w-6 text-indigo-400" />
        Goal Cascading
      </h1>
      <p className="text-sm text-muted-foreground mt-1">
        Visualise how organisational goals cascade to departments and individual KPIs
      </p>
    </div>
  )
}
