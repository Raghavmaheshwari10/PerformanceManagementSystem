'use client'

import { useActionState, useState } from 'react'
import { createCycle } from '../../actions'
import { SubmitButton } from '@/components/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionResult } from '@/lib/types'

interface ReviewTemplateOption {
  id: string
  name: string
  description: string | null
  questionCount: number
}

interface Props {
  departments: { id: string; name: string }[]
  employeesByDept: Record<string, { id: string; full_name: string }[]>
  unassignedEmployees: { id: string; full_name: string }[]
  reviewTemplates: ReviewTemplateOption[]
}

const INITIAL: ActionResult = { data: null, error: null }

export function CycleForm({ departments, employeesByDept, unassignedEmployees, reviewTemplates }: Props) {
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
              scopeType === 'org' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-border/80'
            }`}
          >
            <p className="font-medium">Org-wide</p>
            <p className="text-xs text-muted-foreground mt-0.5">All employees across all departments</p>
          </button>
          <button
            type="button"
            onClick={() => setScopeType('dept')}
            className={`flex-1 rounded-lg border p-3 text-left text-sm transition-colors ${
              scopeType === 'dept' ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-border/80'
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
                  <div key={dept.id} className={`rounded-lg border transition-colors ${isSelected ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
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
                      <div className="border-t border-border px-3 py-2 grid grid-cols-2 gap-1">
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
              <details className="rounded-lg border border-border">
                <summary className="cursor-pointer p-3 text-sm font-medium hover:bg-muted/30 list-none [&::-webkit-details-marker]:hidden flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Include employees from other departments
                  {includedEmps.size > 0 && (
                    <span className="text-xs text-primary">({includedEmps.size} selected)</span>
                  )}
                </summary>
                <div className="border-t border-border px-3 py-2 grid grid-cols-2 gap-1 max-h-48 overflow-y-auto">
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

      {/* ── Section 3: Competency Assessment ── */}
      <section className="glass rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Competency Assessment</h2>
        <p className="text-xs text-muted-foreground">
          Optionally link a review template to this cycle. Managers will rate employees on competency questions alongside KPIs.
        </p>

        {reviewTemplates.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No review templates created yet. Create one in Admin → Review Templates first.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="review_template_id">Review Template</Label>
              <select
                id="review_template_id"
                name="review_template_id"
                className="w-full appearance-none rounded-lg border border-border bg-muted/30 px-3 py-2 pr-8 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                <option value="">— None (KPI-only cycle) —</option>
                {reviewTemplates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.questionCount} question{t.questionCount !== 1 ? 's' : ''})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="competency_weight">Competency Weight (%)</Label>
              <p className="text-xs text-muted-foreground">
                How much of the final score comes from competency assessment. Rest comes from KPI performance. Default: 30%.
              </p>
              <Input
                id="competency_weight"
                name="competency_weight"
                type="number"
                min={0}
                max={100}
                step={5}
                defaultValue={30}
                className="w-32"
              />
            </div>
          </>
        )}
      </section>

      {/* ── Section 4: Deadlines ── */}
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

      <SubmitButton className="w-full" pendingLabel="Creating cycle...">Create Cycle</SubmitButton>
    </form>
  )
}
