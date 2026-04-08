'use client'

import { useActionState, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { saveOrgAop, saveDepartmentSplit } from './actions'
import { SubmitButton } from '@/components/submit-button'
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
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

const FY_OPTIONS = ['FY25', 'FY26', 'FY27', 'FY28'] as const

const INITIAL: ActionResult = { data: null, error: null }

interface SerializedOrgAop {
  id: string
  fiscal_year: string
  metric: string
  annual_target: number
  apr: number; may: number; jun: number; jul: number
  aug: number; sep: number; oct: number; nov: number
  dec: number; jan: number; feb: number; mar: number
  department_aops: SerializedDeptAop[]
}

interface SerializedDeptAop {
  id: string
  org_aop_id: string
  department_id: string
  department_name: string
  annual_target: number
  apr: number; may: number; jun: number; jul: number
  aug: number; sep: number; oct: number; nov: number
  dec: number; jan: number; feb: number; mar: number
}

interface Props {
  departments: { id: string; name: string }[]
  orgAops: SerializedOrgAop[]
  selectedFy: string
  selectedMetric: string
}

function formatLacs(n: number): string {
  if (n === 0) return '0.00'
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function AopForm({ departments, orgAops, selectedFy, selectedMetric }: Props) {
  const router = useRouter()
  const [activeFy, setActiveFy] = useState(selectedFy)
  const [activeMetric, setActiveMetric] = useState(selectedMetric)

  // ── Org target state ──
  const existingOrg = useMemo(
    () => orgAops.find((o) => o.metric === activeMetric),
    [orgAops, activeMetric]
  )

  const [orgAnnual, setOrgAnnual] = useState<string>(existingOrg ? String(existingOrg.annual_target) : '')
  const [orgMonthly, setOrgMonthly] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const m of MONTHS) {
      init[m] = existingOrg ? String((existingOrg as unknown as Record<string, unknown>)[m]) : ''
    }
    return init
  })

  // ── Department split state ──
  const [deptValues, setDeptValues] = useState<Record<string, { annual: string; monthly: Record<string, string> }>>(() => {
    const init: Record<string, { annual: string; monthly: Record<string, string> }> = {}
    for (const dept of departments) {
      const existing = existingOrg?.department_aops.find((d) => d.department_id === dept.id)
      const monthly: Record<string, string> = {}
      for (const m of MONTHS) {
        monthly[m] = existing ? String((existing as unknown as Record<string, unknown>)[m]) : ''
      }
      init[dept.id] = {
        annual: existing ? String(existing.annual_target) : '',
        monthly,
      }
    }
    return init
  })

  // ── Server action states ──
  const [orgState, orgAction] = useActionState(saveOrgAop, INITIAL)
  const [deptState, deptAction] = useActionState(saveDepartmentSplit, INITIAL)

  // ── Sync state when FY/metric changes ──
  const handleFyChange = useCallback((fy: string) => {
    setActiveFy(fy)
    router.push(`/admin/aop?fy=${fy}&metric=${activeMetric}`)
  }, [activeMetric, router])

  const handleMetricChange = useCallback((metric: string) => {
    setActiveMetric(metric)
    router.push(`/admin/aop?fy=${activeFy}&metric=${metric}`)
  }, [activeFy, router])

  // Re-sync local state when orgAops changes (after navigation/revalidation)
  useMemo(() => {
    const found = orgAops.find((o) => o.metric === activeMetric)
    setOrgAnnual(found ? String(found.annual_target) : '')
    const mInit: Record<string, string> = {}
    for (const m of MONTHS) {
      mInit[m] = found ? String((found as unknown as Record<string, unknown>)[m]) : ''
    }
    setOrgMonthly(mInit)

    const dInit: Record<string, { annual: string; monthly: Record<string, string> }> = {}
    for (const dept of departments) {
      const existing = found?.department_aops.find((d) => d.department_id === dept.id)
      const monthly: Record<string, string> = {}
      for (const m of MONTHS) {
        monthly[m] = existing ? String((existing as unknown as Record<string, unknown>)[m]) : ''
      }
      dInit[dept.id] = {
        annual: existing ? String(existing.annual_target) : '',
        monthly,
      }
    }
    setDeptValues(dInit)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgAops, activeMetric])

  // ── Org validation ──
  const orgAnnualNum = Number(orgAnnual) || 0
  const orgMonthlySum = MONTHS.reduce((sum, m) => sum + (Number(orgMonthly[m]) || 0), 0)
  const orgValid = orgAnnualNum > 0 && Math.abs(orgMonthlySum - orgAnnualNum) < 0.01

  // ── Department validation ──
  const deptTotals = useMemo(() => {
    const annualTotal = departments.reduce((sum, d) => sum + (Number(deptValues[d.id]?.annual) || 0), 0)
    const monthlyTotals: Record<string, number> = {}
    for (const m of MONTHS) {
      monthlyTotals[m] = departments.reduce((sum, d) => sum + (Number(deptValues[d.id]?.monthly[m]) || 0), 0)
    }
    return { annualTotal, monthlyTotals }
  }, [departments, deptValues])

  const deptAnnualMatch = orgAnnualNum > 0 && Math.abs(deptTotals.annualTotal - orgAnnualNum) < 0.01
  const deptMonthlyMatch = useMemo(() => {
    const result: Record<string, boolean> = {}
    for (const m of MONTHS) {
      const orgVal = Number(orgMonthly[m]) || 0
      result[m] = orgVal > 0 && Math.abs(deptTotals.monthlyTotals[m] - orgVal) < 0.01
    }
    return result
  }, [deptTotals.monthlyTotals, orgMonthly])

  const allDeptPerRowValid = useMemo(() => {
    return departments.every((d) => {
      const annual = Number(deptValues[d.id]?.annual) || 0
      if (annual <= 0) return false
      const monthSum = MONTHS.reduce((sum, m) => sum + (Number(deptValues[d.id]?.monthly[m]) || 0), 0)
      return Math.abs(monthSum - annual) < 0.01
    })
  }, [departments, deptValues])

  const allDeptValid = deptAnnualMatch && Object.values(deptMonthlyMatch).every(Boolean) && allDeptPerRowValid

  // Only show dept split if org target is saved
  const orgAopId = existingOrg?.id

  return (
    <div className="space-y-6">
      {/* FY Selector */}
      <div className="flex items-center gap-2">
        {FY_OPTIONS.map((fy) => (
          <button
            key={fy}
            type="button"
            onClick={() => handleFyChange(fy)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeFy === fy
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                : 'glass-interactive border border-white/10 text-white/60 hover:text-white/80'
            }`}
          >
            {fy}
          </button>
        ))}
      </div>

      {/* Metric Tabs */}
      <div className="flex border-b border-white/10">
        {METRICS.map((metric) => (
          <button
            key={metric.value}
            type="button"
            onClick={() => handleMetricChange(metric.value)}
            className={`px-5 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
              activeMetric === metric.value
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-white/50 hover:text-white/70 hover:border-white/20'
            }`}
          >
            {metric.label}
          </button>
        ))}
      </div>

      {/* Org Target Section */}
      <div className="glass rounded-xl border border-white/10 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white/90">Org Target</h2>

        {orgState.error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-400">
            <XCircle className="h-4 w-4 shrink-0" />
            {orgState.error}
          </div>
        )}
        {orgState !== INITIAL && !orgState.error && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 text-sm text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Org target saved successfully
          </div>
        )}

        <form action={orgAction} className="space-y-4">
          <input type="hidden" name="fiscal_year" value={activeFy} />
          <input type="hidden" name="metric" value={activeMetric} />

          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              Annual Target (in Lacs)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">&#8377;</span>
              <input
                type="number"
                name="annual_target"
                step="0.01"
                min="0"
                value={orgAnnual}
                onChange={(e) => setOrgAnnual(e.target.value)}
                className="w-full max-w-xs rounded-lg bg-white/10 border border-white/20 px-3 py-2 pl-7 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              Monthly Breakdown (in Lacs)
            </label>
            <div className="grid grid-cols-6 gap-2">
              {MONTHS.map((m) => (
                <div key={m}>
                  <label className="block text-[10px] text-white/40 mb-0.5 uppercase">{MONTH_LABELS[m]}</label>
                  <input
                    type="number"
                    name={m}
                    step="0.01"
                    min="0"
                    value={orgMonthly[m]}
                    onChange={(e) => setOrgMonthly((prev) => ({ ...prev, [m]: e.target.value }))}
                    className="w-full rounded-lg bg-white/10 border border-white/20 px-2 py-1.5 text-sm text-white text-right placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-white/50">Sum:</span>
              <span className="font-mono text-white/90">&#8377;{formatLacs(orgMonthlySum)}</span>
              {orgAnnualNum > 0 && (
                orgValid ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )
              )}
            </div>
            <SubmitButton
              disabled={!orgValid}
              pendingLabel="Saving..."
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Save Org Target
            </SubmitButton>
          </div>
        </form>
      </div>

      {/* Department Split Section */}
      {orgAopId && (
        <div className="glass rounded-xl border border-white/10 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white/90">Department Split</h2>

          {deptState.error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-400">
              <XCircle className="h-4 w-4 shrink-0" />
              {deptState.error}
            </div>
          )}
          {deptState !== INITIAL && !deptState.error && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 text-sm text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Department targets saved and notifications sent
            </div>
          )}

          <form action={deptAction}>
            <input type="hidden" name="org_aop_id" value={orgAopId} />
            <input type="hidden" name="department_ids" value={departments.map((d) => d.id).join(',')} />

            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-3 text-xs font-medium text-white/50 w-[140px]">Department</th>
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
                  {departments.map((dept) => {
                    const dv = deptValues[dept.id]
                    const annual = Number(dv?.annual) || 0
                    const monthSum = MONTHS.reduce((s, m) => s + (Number(dv?.monthly[m]) || 0), 0)
                    const rowValid = annual > 0 && Math.abs(monthSum - annual) < 0.01

                    return (
                      <tr key={dept.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="py-2 pr-3 text-white/80 text-xs font-medium">{dept.name}</td>
                        <td className="py-1.5 px-1">
                          <input
                            type="number"
                            name={`dept_${dept.id}_annual`}
                            step="0.01"
                            min="0"
                            value={dv?.annual ?? ''}
                            onChange={(e) =>
                              setDeptValues((prev) => ({
                                ...prev,
                                [dept.id]: { ...prev[dept.id], annual: e.target.value },
                              }))
                            }
                            className="w-full rounded bg-white/10 border border-white/20 px-1.5 py-1 text-xs text-white text-right focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                            placeholder="0"
                          />
                        </td>
                        {MONTHS.map((m) => (
                          <td key={m} className="py-1.5 px-0.5">
                            <input
                              type="number"
                              name={`dept_${dept.id}_${m}`}
                              step="0.01"
                              min="0"
                              value={dv?.monthly[m] ?? ''}
                              onChange={(e) =>
                                setDeptValues((prev) => ({
                                  ...prev,
                                  [dept.id]: {
                                    ...prev[dept.id],
                                    monthly: { ...prev[dept.id].monthly, [m]: e.target.value },
                                  },
                                }))
                              }
                              className="w-full rounded bg-white/10 border border-white/20 px-1 py-1 text-[11px] text-white text-right focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                              placeholder="0"
                            />
                          </td>
                        ))}
                        <td className="py-2 pl-2 text-center">
                          {annual > 0 && (
                            rowValid ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 inline" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-red-400 inline" />
                            )
                          )}
                        </td>
                      </tr>
                    )
                  })}

                  {/* Totals row */}
                  <tr className="border-t border-white/10 bg-white/[0.03]">
                    <td className="py-2 pr-3 text-xs font-semibold text-white/70">Total</td>
                    <td className="py-2 px-2 text-right text-xs font-mono text-white/80">
                      {formatLacs(deptTotals.annualTotal)}
                    </td>
                    {MONTHS.map((m) => (
                      <td key={m} className="py-2 px-1 text-right text-[11px] font-mono text-white/80">
                        {formatLacs(deptTotals.monthlyTotals[m])}
                      </td>
                    ))}
                    <td></td>
                  </tr>

                  {/* Org target row */}
                  <tr className="bg-white/[0.02]">
                    <td className="py-2 pr-3 text-xs font-semibold text-white/50">Org Target</td>
                    <td className="py-2 px-2 text-right text-xs font-mono text-white/50">
                      {formatLacs(orgAnnualNum)}
                    </td>
                    {MONTHS.map((m) => (
                      <td key={m} className="py-2 px-1 text-right text-[11px] font-mono text-white/50">
                        {formatLacs(Number(orgMonthly[m]) || 0)}
                      </td>
                    ))}
                    <td></td>
                  </tr>

                  {/* Diff row */}
                  <tr>
                    <td className="py-2 pr-3 text-xs font-semibold text-white/50">Diff</td>
                    <td className={`py-2 px-2 text-right text-xs font-mono ${deptAnnualMatch ? 'text-emerald-400' : 'text-red-400'}`}>
                      {deptAnnualMatch ? (
                        <CheckCircle2 className="h-3.5 w-3.5 inline" />
                      ) : (
                        <span>{formatLacs(deptTotals.annualTotal - orgAnnualNum)}</span>
                      )}
                    </td>
                    {MONTHS.map((m) => {
                      const orgVal = Number(orgMonthly[m]) || 0
                      const diff = deptTotals.monthlyTotals[m] - orgVal
                      const match = deptMonthlyMatch[m]
                      return (
                        <td key={m} className={`py-2 px-1 text-right text-[11px] font-mono ${match ? 'text-emerald-400' : 'text-red-400'}`}>
                          {match ? (
                            <CheckCircle2 className="h-3 w-3 inline" />
                          ) : orgVal > 0 ? (
                            <span>{diff > 0 ? '+' : ''}{formatLacs(diff)}</span>
                          ) : (
                            <span className="text-white/20">-</span>
                          )}
                        </td>
                      )
                    })}
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4">
              {!allDeptValid && orgAnnualNum > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  All row sums and column totals must match org targets
                </div>
              )}
              <div className="ml-auto">
                <SubmitButton
                  disabled={!allDeptValid}
                  pendingLabel="Saving..."
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Save &amp; Notify Department Heads
                </SubmitButton>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Prompt to save org target first */}
      {!orgAopId && orgAnnualNum > 0 && (
        <div className="glass rounded-xl border border-white/10 p-6">
          <p className="text-sm text-white/50 text-center">
            Save the org target first to enable department split
          </p>
        </div>
      )}
    </div>
  )
}
