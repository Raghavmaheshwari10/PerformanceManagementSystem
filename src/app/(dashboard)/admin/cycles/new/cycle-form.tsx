'use client'

import { useActionState, useState } from 'react'
import { createCycle } from '../../actions'
import { SubmitButton } from '@/components/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionResult } from '@/lib/types'

interface Props {
  departments: { id: string; name: string }[]
  employeesByDept: Record<string, { id: string; full_name: string }[]>
  unassignedEmployees: { id: string; full_name: string }[]
}

const INITIAL: ActionResult = { data: null, error: null }

export function CycleForm({ departments, employeesByDept, unassignedEmployees }: Props) {
  const [state, action] = useActionState(createCycle, INITIAL)
  const [scopeType, setScopeType] = useState<'org' | 'dept'>('org')
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set())
  const [excludedEmps, setExcludedEmps] = useState<Set<string>>(new Set())
  const [includedEmps, setIncludedEmps] = useState<Set<string>>(new Set())
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())

  function toggleDept(deptId: string) {
    const next = new Set(selectedDepts)
    if (next.has(deptId)) {
      next.delete(deptId)
      // Remove exclusions for this dept's employees
      const deptEmps = employeesByDept[deptId] || []
      const nextExcl = new Set(excludedEmps)
      deptEmps.forEach(e => nextExcl.delete(e.id))
      setExcludedEmps(nextExcl)
    } else {
      next.add(deptId)
    }
    setSelectedDepts(next)
  }

  function toggleExclude(empId: string) {
    const next = new Set(excludedEmps)
    if (next.has(empId)) next.delete(empId)
    else next.add(empId)
    setExcludedEmps(next)
  }

  function toggleInclude(empId: string) {
    const next = new Set(includedEmps)
    if (next.has(empId)) next.delete(empId)
    else next.add(empId)
    setIncludedEmps(next)
  }

  function toggleExpandDept(deptId: string) {
    const next = new Set(expandedDepts)
    if (next.has(deptId)) next.delete(deptId)
    else next.add(deptId)
    setExpandedDepts(next)
  }

  // Calculate total employees in scope
  const totalInScope = (() => {
    if (scopeType === 'org') {
      const allEmps = Object.values(employeesByDept).flat()
      return allEmps.length + unassignedEmployees.length
    }
    let count = 0
    for (const deptId of selectedDepts) {
      const deptEmps = employeesByDept[deptId] || []
      count += deptEmps.filter(e => !excludedEmps.has(e.id)).length
    }
    count += includedEmps.size
    return count
  })()

  // Employees not in selected departments (for "include additional")
  const nonSelectedEmployees = scopeType === 'dept'
    ? Object.entries(employeesByDept)
        .filter(([deptId]) => !selectedDepts.has(deptId))
        .flatMap(([, emps]) => emps)
        .concat(unassignedEmployees)
    : []

  return (
    <form action={action} className="space-y-6">
      {state.error && (
        <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      {/* Hidden fields for scope data */}
      {scopeType === 'dept' && (
        <>
          {[...selectedDepts].map(id => (
            <input key={id} type="hidden" name="department_ids" value={id} />
          ))}
          {[...excludedEmps].map(id => (
            <input key={id} type="hidden" name="excluded_employee_ids" value={id} />
          ))}
          {[...includedEmps].map(id => (
            <input key={id} type="hidden" name="included_employee_ids" value={id} />
          ))}
        </>
      )}

      {/* ── Section 1: Basic Info ── */}
      <section className="glass rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Basic Info</h2>

        <div className="space-y-2">
          <Label htmlFor="name">Cycle Name</Label>
          <Input id="name" name="name" placeholder="Q1 2026" required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="quarter">Quarter</Label>
            <Input id="quarter" name="quarter" placeholder="Q1" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="year">Year</Label>
            <Input id="year" name="year" type="number" defaultValue={2026} required />
          </div>
        </div>
      </section>

      {/* ── Section 2: Scope ── */}
      <section className="glass rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Scope</h2>
          <span className="text-xs text-muted-foreground">{totalInScope} employee{totalInScope !== 1 ? 's' : ''} in scope</span>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setScopeType('org')}
            className={`flex-1 rounded-lg border p-3 text-left text-sm transition-colors ${
              scopeType === 'org' ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 hover:border-white/20'
            }`}
          >
            <p className="font-medium">Org-wide</p>
            <p className="text-xs text-muted-foreground mt-0.5">All employees across all departments</p>
          </button>
          <button
            type="button"
            onClick={() => setScopeType('dept')}
            className={`flex-1 rounded-lg border p-3 text-left text-sm transition-colors ${
              scopeType === 'dept' ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 hover:border-white/20'
            }`}
          >
            <p className="font-medium">Select Departments</p>
            <p className="text-xs text-muted-foreground mt-0.5">Choose departments and optionally exclude employees</p>
          </button>
        </div>

        {scopeType === 'dept' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Select departments to include. Each department will have its own stage progression.
              You can exclude specific employees by expanding a department.
            </p>

            {/* Department checkboxes */}
            <div className="space-y-2">
              {departments.map(dept => {
                const isSelected = selectedDepts.has(dept.id)
                const deptEmps = employeesByDept[dept.id] || []
                const excludedCount = deptEmps.filter(e => excludedEmps.has(e.id)).length
                const isExpanded = expandedDepts.has(dept.id)

                return (
                  <div key={dept.id} className={`rounded-lg border transition-colors ${isSelected ? 'border-primary/30 bg-primary/5' : 'border-white/10'}`}>
                    <div className="flex items-center justify-between p-3">
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleDept(dept.id)}
                          className="rounded"
                        />
                        <span className="text-sm font-medium">{dept.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {deptEmps.length} employee{deptEmps.length !== 1 ? 's' : ''}
                          {excludedCount > 0 && ` (${excludedCount} excluded)`}
                        </span>
                      </label>
                      {isSelected && deptEmps.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleExpandDept(dept.id)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? 'Hide' : 'Show'} employees
                        </button>
                      )}
                    </div>

                    {isSelected && isExpanded && deptEmps.length > 0 && (
                      <div className="border-t border-white/5 px-3 py-2 grid grid-cols-2 gap-1">
                        {deptEmps.map(emp => (
                          <label key={emp.id} className="flex items-center gap-2 py-1 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!excludedEmps.has(emp.id)}
                              onChange={() => toggleExclude(emp.id)}
                              className="rounded"
                            />
                            <span className={excludedEmps.has(emp.id) ? 'line-through text-muted-foreground' : ''}>
                              {emp.full_name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Include employees from non-selected departments */}
            {nonSelectedEmployees.length > 0 && selectedDepts.size > 0 && (
              <details className="rounded-lg border border-white/10">
                <summary className="cursor-pointer p-3 text-sm font-medium hover:bg-white/5 list-none [&::-webkit-details-marker]:hidden flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Include employees from other departments
                  {includedEmps.size > 0 && (
                    <span className="text-xs text-primary">({includedEmps.size} selected)</span>
                  )}
                </summary>
                <div className="border-t border-white/5 px-3 py-2 grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
                  {nonSelectedEmployees.map(emp => (
                    <label key={emp.id} className="flex items-center gap-2 py-1 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includedEmps.has(emp.id)}
                        onChange={() => toggleInclude(emp.id)}
                        className="rounded"
                      />
                      {emp.full_name}
                    </label>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </section>

      {/* ── Section 3: Deadlines ── */}
      <section className="glass rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Deadlines</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="kpi_setting_deadline">KPI Setting</Label>
            <Input id="kpi_setting_deadline" name="kpi_setting_deadline" type="date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="self_review_deadline">Self Review</Label>
            <Input id="self_review_deadline" name="self_review_deadline" type="date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manager_review_deadline">Manager Review</Label>
            <Input id="manager_review_deadline" name="manager_review_deadline" type="date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="calibration_deadline">Calibration</Label>
            <Input id="calibration_deadline" name="calibration_deadline" type="date" />
          </div>
        </div>
      </section>

      {/* ── Section 4: Payout Settings ── */}
      <details className="glass rounded-xl group">
        <summary className="cursor-pointer p-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:bg-white/5 rounded-xl list-none [&::-webkit-details-marker]:hidden flex items-center justify-between">
          Payout Settings
          <svg xmlns="http://www.w3.org/2000/svg" className="size-4 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </summary>
        <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
          <div className="space-y-2">
            <Label htmlFor="sme_multiplier">SME Payout Multiplier (0-5)</Label>
            <Input id="sme_multiplier" name="sme_multiplier" type="number" step="0.01" placeholder="0.50" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="business_multiplier">Business Multiplier (0-2.0)</Label>
              <Input id="business_multiplier" name="business_multiplier" type="number" step="0.05" defaultValue={1.0} min={0} max={2} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget_currency">Currency</Label>
              <select id="budget_currency" name="budget_currency" defaultValue="INR" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs">
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="total_budget">Total Budget (optional)</Label>
            <Input id="total_budget" name="total_budget" type="number" step="1000" placeholder="Leave blank if not applicable" />
          </div>

          <div className="border-t border-white/5 pt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Per-cycle multiplier overrides (optional)</p>
            <p className="text-xs text-muted-foreground">Leave blank to use global payout config defaults.</p>
            <div className="grid grid-cols-3 gap-3 mt-2">
              {(['FEE', 'EE', 'ME'] as const).map(tier => (
                <div key={tier} className="space-y-1">
                  <label className="text-xs font-medium">{tier} override</label>
                  <input
                    name={`${tier.toLowerCase()}_multiplier`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 1.30"
                    className="w-full rounded border px-2 py-1.5 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>

      <SubmitButton className="w-full" pendingLabel="Creating cycle...">Create Cycle</SubmitButton>
    </form>
  )
}
