'use client'

import { useState, useTransition, Fragment } from 'react'
import { TargetForm } from './target-form'
import { ActualsForm } from './actuals-form'
import { deleteTarget } from './actions'
import { Plus, Pencil, Trash2, BarChart3, ChevronDown, ChevronRight } from 'lucide-react'

interface Department { id: string; name: string }
interface Employee { id: string; full_name: string; email: string; department_id: string | null }
interface Target {
  id: string
  metric_name: string
  category: string
  level: string
  annual_target: number
  unit: string
  ytd_actual: number
  department_id: string | null
  employee_id: string | null
  department_name: string | null
  employee_name: string | null
  red_threshold: number
  amber_threshold: number
  actuals: Record<number, number> // month -> value
}

interface MisClientProps {
  targets: Target[]
  departments: Department[]
  employees: Employee[]
  fiscalYear: number
}

function ragBadge(pct: number, red: number, amber: number) {
  if (pct >= amber) return <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">Green</span>
  if (pct >= red) return <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">Amber</span>
  return <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">Red</span>
}

const CATEGORY_BADGE: Record<string, string> = {
  financial: 'bg-blue-500/20 text-blue-400',
  operational: 'bg-purple-500/20 text-purple-400',
  people: 'bg-emerald-500/20 text-emerald-400',
  customer: 'bg-amber-500/20 text-amber-400',
  process: 'bg-pink-500/20 text-pink-400',
}

export function MisClient({ targets, departments, employees, fiscalYear }: MisClientProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTarget, setEditingTarget] = useState<Target | null>(null)
  const [expandedActuals, setExpandedActuals] = useState<string | null>(null)
  const [deletingId, startDelete] = useTransition()

  function handleDelete(targetId: string) {
    if (!confirm('Delete this target and all its monthly actuals?')) return
    startDelete(async () => {
      await deleteTarget(targetId)
    })
  }

  return (
    <div className="space-y-4">
      {/* Add button */}
      {!showAddForm && !editingTarget && (
        <button
          onClick={() => setShowAddForm(true)}
          className="glow-button flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" />
          Add Target
        </button>
      )}

      {/* Add form */}
      {showAddForm && (
        <TargetForm
          departments={departments}
          employees={employees}
          fiscalYear={fiscalYear}
          onClose={() => setShowAddForm(false)}
        />
      )}

      {/* Edit form */}
      {editingTarget && (
        <TargetForm
          departments={departments}
          employees={employees}
          fiscalYear={fiscalYear}
          editTarget={{
            id: editingTarget.id,
            metric_name: editingTarget.metric_name,
            category: editingTarget.category,
            level: editingTarget.level,
            annual_target: editingTarget.annual_target,
            unit: editingTarget.unit,
            department_id: editingTarget.department_id,
            employee_id: editingTarget.employee_id,
            red_threshold: editingTarget.red_threshold,
            amber_threshold: editingTarget.amber_threshold,
          }}
          onClose={() => setEditingTarget(null)}
        />
      )}

      {/* Targets table */}
      {targets.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center py-10 text-center">
          <p className="text-sm font-medium mb-1">No targets yet</p>
          <p className="text-xs text-muted-foreground">Add targets manually, import via CSV, or sync from external MIS.</p>
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="p-3 text-left text-muted-foreground w-8"></th>
                <th className="p-3 text-left text-muted-foreground">Metric</th>
                <th className="p-3 text-left text-muted-foreground">Category</th>
                <th className="p-3 text-left text-muted-foreground">Level</th>
                <th className="p-3 text-left text-muted-foreground">Assigned To</th>
                <th className="p-3 text-right text-muted-foreground">Annual Target</th>
                <th className="p-3 text-right text-muted-foreground">YTD Actual</th>
                <th className="p-3 text-right text-muted-foreground">Achievement</th>
                <th className="p-3 text-center text-muted-foreground">RAG</th>
                <th className="p-3 text-right text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {targets.map(t => {
                const achievement = t.annual_target > 0 ? (t.ytd_actual / t.annual_target) * 100 : 0
                const isExpanded = expandedActuals === t.id
                return (
                  <Fragment key={t.id}>
                    <tr className="border-b border-border hover:bg-muted/10">
                      <td className="p-3">
                        <button
                          onClick={() => setExpandedActuals(isExpanded ? null : t.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title="Enter monthly actuals"
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="p-3 font-medium">{t.metric_name}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${CATEGORY_BADGE[t.category] ?? 'bg-muted/50'}`}>
                          {t.category}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground capitalize">{t.level}</td>
                      <td className="p-3 text-muted-foreground">
                        {t.employee_name ?? t.department_name ?? '—'}
                      </td>
                      <td className="p-3 text-right tabular-nums">{t.annual_target.toLocaleString('en-IN')} {t.unit}</td>
                      <td className="p-3 text-right tabular-nums">{t.ytd_actual.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right tabular-nums">{achievement.toFixed(1)}%</td>
                      <td className="p-3 text-center">{ragBadge(achievement, t.red_threshold, t.amber_threshold)}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => { setEditingTarget(t); setShowAddForm(false) }}
                            className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                            title="Edit target"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="rounded p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete target"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-border bg-muted/10">
                        <td colSpan={10} className="p-4">
                          <ActualsForm
                            targetId={t.id}
                            targetName={t.metric_name}
                            year={fiscalYear}
                            existingActuals={t.actuals}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
