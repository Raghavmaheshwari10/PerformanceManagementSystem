'use client'

import { useActionState, useState, useMemo } from 'react'
import { saveEmployeeCascade, lockCascade } from './actions'
import { SubmitButton } from '@/components/submit-button'
import { CheckCircle2, XCircle, AlertTriangle, Lock } from 'lucide-react'
import type { ActionResult } from '@/lib/types'

const MONTHS = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'] as const
const MONTH_LABELS: Record<string, string> = {
  apr: 'Apr', may: 'May', jun: 'Jun', jul: 'Jul',
  aug: 'Aug', sep: 'Sep', oct: 'Oct', nov: 'Nov',
  dec: 'Dec', jan: 'Jan', feb: 'Feb', mar: 'Mar',
}

const METRICS = [
  { value: 'delivered_revenue', label: 'Delivered Revenue' },
  { value: 'gross_margin', label: 'Gross Margin' },
  { value: 'gmv', label: 'GMV' },
] as const

const INITIAL: ActionResult = { data: null, error: null }

interface SerializedEmployeeAop {
  id: string
  department_aop_id: string
  employee_id: string
  employee_name: string
  annual_target: number
  apr: number; may: number; jun: number; jul: number
  aug: number; sep: number; oct: number; nov: number
  dec: number; jan: number; feb: number; mar: number
}

interface SerializedDeptAop {
  id: string
  org_aop_id: string
  department_id: string
  status: string
  metric: string
  fiscal_year: string
  annual_target: number
  apr: number; may: number; jun: number; jul: number
  aug: number; sep: number; oct: number; nov: number
  dec: number; jan: number; feb: number; mar: number
  employee_aops: SerializedEmployeeAop[]
}

interface Props {
  departmentName: string
  fiscalYear: string
  departmentAops: SerializedDeptAop[]
  employees: { id: string; full_name: string }[]
}

function formatLacs(n: number): string {
  if (n === 0) return '0.00'
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function CascadeForm({ departmentName, fiscalYear, departmentAops, employees }: Props) {
  const [activeMetric, setActiveMetric] = useState(
    departmentAops.length > 0 ? departmentAops[0].metric : 'delivered_revenue'
  )

  // Find the department AOP for the active metric
  const activeDeptAop = useMemo(
    () => departmentAops.find((da) => da.metric === activeMetric),
    [departmentAops, activeMetric]
  )

  const isLocked = activeDeptAop?.status === 'locked'

  // Employee values state — keyed by metric to persist across tab switches
  const [empValuesByMetric, setEmpValuesByMetric] = useState<
    Record<string, Record<string, { annual: string; monthly: Record<string, string> }>>
  >(() => {
    const byMetric: Record<string, Record<string, { annual: string; monthly: Record<string, string> }>> = {}
    for (const metric of METRICS) {
      const deptAop = departmentAops.find((da) => da.metric === metric.value)
      const empInit: Record<string, { annual: string; monthly: Record<string, string> }> = {}
      for (const emp of employees) {
        const existing = deptAop?.employee_aops.find((ea) => ea.employee_id === emp.id)
        const monthly: Record<string, string> = {}
        for (const m of MONTHS) {
          monthly[m] = existing ? String((existing as unknown as Record<string, unknown>)[m]) : ''
        }
        empInit[emp.id] = {
          annual: existing ? String(existing.annual_target) : '',
          monthly,
        }
      }
      byMetric[metric.value] = empInit
    }
    return byMetric
  })

  const empValues = empValuesByMetric[activeMetric] ?? {}

  const setEmpValue = (empId: string, field: string, value: string) => {
    setEmpValuesByMetric((prev) => {
      const metricVals = { ...prev[activeMetric] }
      if (field === 'annual') {
        metricVals[empId] = { ...metricVals[empId], annual: value }
      } else {
        metricVals[empId] = {
          ...metricVals[empId],
          monthly: { ...metricVals[empId].monthly, [field]: value },
        }
      }
      return { ...prev, [activeMetric]: metricVals }
    })
  }

  // Server action states
  const [saveState, saveAction] = useActionState(saveEmployeeCascade, INITIAL)
  const [lockState, lockAction] = useActionState(lockCascade, INITIAL)

  // Totals computation
  const totals = useMemo(() => {
    const annualTotal = employees.reduce((sum, e) => sum + (Number(empValues[e.id]?.annual) || 0), 0)
    const monthlyTotals: Record<string, number> = {}
    for (const m of MONTHS) {
      monthlyTotals[m] = employees.reduce((sum, e) => sum + (Number(empValues[e.id]?.monthly[m]) || 0), 0)
    }
    return { annualTotal, monthlyTotals }
  }, [employees, empValues])

  // Validation
  const deptAnnual = activeDeptAop?.annual_target ?? 0
  const annualUnallocated = deptAnnual - totals.annualTotal

  const monthlyUnallocated = useMemo(() => {
    const result: Record<string, number> = {}
    for (const m of MONTHS) {
      const deptVal = activeDeptAop ? Number((activeDeptAop as unknown as Record<string, unknown>)[m]) : 0
      result[m] = deptVal - (totals.monthlyTotals[m] || 0)
    }
    return result
  }, [activeDeptAop, totals.monthlyTotals])

  const isFullyAllocated = Math.abs(annualUnallocated) < 0.01 &&
    MONTHS.every((m) => Math.abs(monthlyUnallocated[m]) < 0.01)

  // Per-row validation: monthly sum = annual
  const rowValid = useMemo(() => {
    const result: Record<string, boolean> = {}
    for (const emp of employees) {
      const annual = Number(empValues[emp.id]?.annual) || 0
      const monthSum = MONTHS.reduce((s, m) => s + (Number(empValues[emp.id]?.monthly[m]) || 0), 0)
      result[emp.id] = annual > 0 && Math.abs(monthSum - annual) < 0.01
    }
    return result
  }, [employees, empValues])

  const allRowsValid = employees.every((e) => {
    const annual = Number(empValues[e.id]?.annual) || 0
    if (annual === 0) return true // Empty rows are OK for draft
    return rowValid[e.id]
  })

  return (
    <div className="space-y-6">
      {/* Department & FY header */}
      <div className="flex items-center gap-4">
        <div className="glass rounded-lg border border-white/10 px-4 py-2">
          <span className="text-xs text-white/50">Department</span>
          <p className="text-sm font-medium text-white/90">{departmentName}</p>
        </div>
        <div className="glass rounded-lg border border-white/10 px-4 py-2">
          <span className="text-xs text-white/50">Fiscal Year</span>
          <p className="text-sm font-medium text-white/90">{fiscalYear}</p>
        </div>
        {isLocked && (
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
            <Lock className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-400">Locked</span>
          </div>
        )}
      </div>

      {/* Metric Tabs */}
      <div className="flex border-b border-white/10">
        {METRICS.map((metric) => {
          const hasDeptAop = departmentAops.some((da) => da.metric === metric.value)
          const metricLocked = departmentAops.find((da) => da.metric === metric.value)?.status === 'locked'
          return (
            <button
              key={metric.value}
              type="button"
              onClick={() => setActiveMetric(metric.value)}
              className={`px-5 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px flex items-center gap-1.5 ${
                activeMetric === metric.value
                  ? 'border-indigo-500 text-indigo-300'
                  : 'border-transparent text-white/50 hover:text-white/70 hover:border-white/20'
              } ${!hasDeptAop ? 'opacity-50' : ''}`}
            >
              {metric.label}
              {metricLocked && <Lock className="h-3 w-3 text-emerald-400" />}
            </button>
          )
        })}
      </div>

      {/* No target message */}
      {!activeDeptAop && (
        <div className="glass rounded-xl border border-white/10 p-6">
          <p className="text-sm text-white/50 text-center">
            No target assigned by Admin yet for this metric. Ask your admin to set department targets.
          </p>
        </div>
      )}

      {/* Department Target (read-only) */}
      {activeDeptAop && (
        <div className="glass rounded-xl border border-white/10 p-6 space-y-3">
          <h2 className="text-sm font-semibold text-white/70">Department Target (set by Admin)</h2>
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-[10px] text-white/40 uppercase block">Annual</span>
              <span className="text-sm font-mono text-white/90">
                &#8377;{formatLacs(activeDeptAop.annual_target)} L
              </span>
            </div>
            {MONTHS.map((m) => (
              <div key={m}>
                <span className="text-[10px] text-white/40 uppercase block">{MONTH_LABELS[m]}</span>
                <span className="text-xs font-mono text-white/70">
                  &#8377;{formatLacs(Number((activeDeptAop as unknown as Record<string, unknown>)[m]))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Cascade Table */}
      {activeDeptAop && (
        <div className="glass rounded-xl border border-white/10 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white/90">Team Cascade</h2>

          {/* Save state messages */}
          {saveState.error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-400">
              <XCircle className="h-4 w-4 shrink-0" />
              {saveState.error}
            </div>
          )}
          {saveState !== INITIAL && !saveState.error && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Draft saved successfully
            </div>
          )}

          {/* Lock state messages */}
          {lockState.error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-400">
              <XCircle className="h-4 w-4 shrink-0" />
              {lockState.error}
            </div>
          )}
          {lockState !== INITIAL && !lockState.error && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Targets locked and employees notified
            </div>
          )}

          {employees.length === 0 ? (
            <p className="text-sm text-white/50 text-center py-4">
              No active employees in your department to assign targets to.
            </p>
          ) : (
            <>
              <form action={saveAction}>
                <input type="hidden" name="department_aop_id" value={activeDeptAop.id} />
                <input type="hidden" name="employee_ids" value={employees.map((e) => e.id).join(',')} />

                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="w-full text-sm min-w-[900px]">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-2 pr-3 text-xs font-medium text-white/50 w-[140px]">Employee</th>
                        <th className="text-right py-2 px-2 text-xs font-medium text-white/50 w-[100px]">Annual</th>
                        {MONTHS.map((m) => (
                          <th key={m} className="text-right py-2 px-1 text-xs font-medium text-white/50 w-[75px]">
                            {MONTH_LABELS[m]}
                          </th>
                        ))}
                        <th className="text-center py-2 pl-2 text-xs font-medium text-white/50 w-[40px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp) => {
                        const ev = empValues[emp.id]
                        const annual = Number(ev?.annual) || 0
                        const monthSum = MONTHS.reduce((s, m) => s + (Number(ev?.monthly[m]) || 0), 0)
                        const valid = rowValid[emp.id]

                        return (
                          <tr key={emp.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                            <td className="py-2 pr-3 text-white/80 text-xs font-medium">{emp.full_name}</td>
                            <td className="py-1.5 px-1">
                              {isLocked ? (
                                <span className="block text-right text-xs font-mono text-white/70 px-1.5 py-1">
                                  {formatLacs(annual)}
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  name={`emp_${emp.id}_annual`}
                                  step="0.01"
                                  min="0"
                                  value={ev?.annual ?? ''}
                                  onChange={(e) => setEmpValue(emp.id, 'annual', e.target.value)}
                                  className="w-full rounded bg-white/10 border border-white/20 px-1.5 py-1 text-xs text-white text-right focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                                  placeholder="0"
                                />
                              )}
                            </td>
                            {MONTHS.map((m) => (
                              <td key={m} className="py-1.5 px-0.5">
                                {isLocked ? (
                                  <span className="block text-right text-[11px] font-mono text-white/70 px-1 py-1">
                                    {formatLacs(Number(ev?.monthly[m]) || 0)}
                                  </span>
                                ) : (
                                  <input
                                    type="number"
                                    name={`emp_${emp.id}_${m}`}
                                    step="0.01"
                                    min="0"
                                    value={ev?.monthly[m] ?? ''}
                                    onChange={(e) => setEmpValue(emp.id, m, e.target.value)}
                                    className="w-full rounded bg-white/10 border border-white/20 px-1 py-1 text-[11px] text-white text-right focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                                    placeholder="0"
                                  />
                                )}
                              </td>
                            ))}
                            <td className="py-2 pl-2 text-center">
                              {annual > 0 && (
                                valid ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 inline" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 text-red-400 inline" />
                                )
                              )}
                            </td>
                          </tr>
                        )
                      })}

                      {/* Total row */}
                      <tr className="border-t border-white/10 bg-white/[0.03]">
                        <td className="py-2 pr-3 text-xs font-semibold text-white/70">Total</td>
                        <td className="py-2 px-2 text-right text-xs font-mono text-white/80">
                          {formatLacs(totals.annualTotal)}
                        </td>
                        {MONTHS.map((m) => (
                          <td key={m} className="py-2 px-1 text-right text-[11px] font-mono text-white/80">
                            {formatLacs(totals.monthlyTotals[m])}
                          </td>
                        ))}
                        <td></td>
                      </tr>

                      {/* Dept target row */}
                      <tr className="bg-white/[0.02]">
                        <td className="py-2 pr-3 text-xs font-semibold text-white/50">Dept Target</td>
                        <td className="py-2 px-2 text-right text-xs font-mono text-white/50">
                          {formatLacs(deptAnnual)}
                        </td>
                        {MONTHS.map((m) => (
                          <td key={m} className="py-2 px-1 text-right text-[11px] font-mono text-white/50">
                            {formatLacs(Number((activeDeptAop as unknown as Record<string, unknown>)[m]))}
                          </td>
                        ))}
                        <td></td>
                      </tr>

                      {/* Unallocated row */}
                      <tr>
                        <td className="py-2 pr-3 text-xs font-semibold text-white/50">Unallocated</td>
                        <td className={`py-2 px-2 text-right text-xs font-mono ${
                          Math.abs(annualUnallocated) < 0.01
                            ? 'text-emerald-400'
                            : annualUnallocated > 0
                              ? 'text-amber-400'
                              : 'text-red-400'
                        }`}>
                          {Math.abs(annualUnallocated) < 0.01 ? (
                            <CheckCircle2 className="h-3.5 w-3.5 inline" />
                          ) : (
                            <span>{annualUnallocated > 0 ? '+' : ''}{formatLacs(annualUnallocated)}</span>
                          )}
                        </td>
                        {MONTHS.map((m) => {
                          const unalloc = monthlyUnallocated[m]
                          const match = Math.abs(unalloc) < 0.01
                          return (
                            <td key={m} className={`py-2 px-1 text-right text-[11px] font-mono ${
                              match
                                ? 'text-emerald-400'
                                : unalloc > 0
                                  ? 'text-amber-400'
                                  : 'text-red-400'
                            }`}>
                              {match ? (
                                <CheckCircle2 className="h-3 w-3 inline" />
                              ) : (
                                <span>{unalloc > 0 ? '+' : ''}{formatLacs(unalloc)}</span>
                              )}
                            </td>
                          )
                        })}
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Action buttons */}
                {!isLocked && (
                  <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center gap-3">
                      {!isFullyAllocated && deptAnnual > 0 && (
                        <div className="flex items-center gap-2 text-xs text-amber-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          &#8377;{formatLacs(Math.abs(annualUnallocated))} L unallocated — assign remaining before locking
                        </div>
                      )}
                      {!allRowsValid && totals.annualTotal > 0 && (
                        <div className="flex items-center gap-2 text-xs text-amber-400">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Some rows have monthly sum mismatch with annual
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <SubmitButton
                        pendingLabel="Saving..."
                        className="rounded-lg bg-white/10 border border-white/20 px-5 py-2 text-sm font-medium text-white/80 hover:bg-white/15 transition-colors"
                      >
                        Save Draft
                      </SubmitButton>
                    </div>
                  </div>
                )}
              </form>

              {/* Lock form — separate form so it doesn't interfere with save */}
              {!isLocked && activeDeptAop && (
                <form action={lockAction} className="flex justify-end">
                  <input type="hidden" name="department_aop_id" value={activeDeptAop.id} />
                  <SubmitButton
                    disabled={!isFullyAllocated}
                    pendingLabel="Locking..."
                    className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    Lock Targets
                  </SubmitButton>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
