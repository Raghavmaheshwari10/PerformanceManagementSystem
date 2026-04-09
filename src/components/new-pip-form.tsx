'use client'

import { useActionState, useState, useMemo } from 'react'
import { createPip } from '@/app/(dashboard)/admin/pip/actions'
import { SubmitButton } from '@/components/submit-button'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { ActionResult } from '@/lib/types'

interface Props {
  employees: { id: string; full_name: string; designation: string | null; department_id: string | null }[]
  cycles: { id: string; name: string }[]
  departments: { id: string; name: string }[]
  redirectBase: string
}

export function NewPipForm({ employees, cycles, departments, redirectBase }: Props) {
  const router = useRouter()
  const [state, action] = useActionState<ActionResult | null, FormData>(createPip, null)
  const [deptFilter, setDeptFilter] = useState('')
  const [search, setSearch] = useState('')

  // Filter employees by department and search
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      if (deptFilter && e.department_id !== deptFilter) return false
      if (search && !e.full_name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [employees, deptFilter, search])

  // Default dates: start = today, end = 90 days from now
  const today = new Date().toISOString().split('T')[0]
  const ninetyDays = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // If creation succeeded, redirect
  if (state && !state.error) {
    router.push(redirectBase)
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
        <p className="text-sm font-medium text-emerald-800">PIP created successfully!</p>
        <p className="text-xs text-emerald-600 mt-1">Redirecting...</p>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-5 rounded-lg border p-6">
      {state?.error && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          {state.error}
        </div>
      )}

      {/* Employee selection */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Select Employee</legend>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="dept_filter" className="text-xs text-muted-foreground">Filter by Department</label>
            <select
              id="dept_filter"
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="w-full rounded border bg-background px-3 py-2 text-sm"
            >
              <option value="">All departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="emp_search" className="text-xs text-muted-foreground">Search by Name</label>
            <input
              id="emp_search"
              type="text"
              placeholder="Type to search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="employee_id" className="text-xs font-medium">Employee *</label>
          <select
            id="employee_id"
            name="employee_id"
            required
            className="w-full rounded border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select an employee...</option>
            {filteredEmployees.map(e => (
              <option key={e.id} value={e.id}>
                {e.full_name}{e.designation ? ` — ${e.designation}` : ''}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            {filteredEmployees.length} employee(s) shown
          </p>
        </div>
      </fieldset>

      {/* Reason */}
      <div className="space-y-1">
        <label htmlFor="reason" className="text-xs font-medium">Reason for PIP *</label>
        <textarea
          id="reason"
          name="reason"
          required
          minLength={10}
          rows={4}
          placeholder="Describe the performance concerns, specific incidents, and areas where improvement is needed..."
          className="w-full rounded border bg-background px-3 py-2 text-sm resize-y"
        />
        <p className="text-[11px] text-muted-foreground">Minimum 10 characters. Be specific about performance gaps.</p>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="start_date" className="text-xs font-medium">Start Date *</label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            required
            defaultValue={today}
            className="w-full rounded border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="end_date" className="text-xs font-medium">End Date *</label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            required
            defaultValue={ninetyDays}
            className="w-full rounded border bg-background px-3 py-2 text-sm"
          />
          <p className="text-[11px] text-muted-foreground">Typical PIP duration: 30-90 days</p>
        </div>
      </div>

      {/* Optional: Link to Review Cycle */}
      <div className="space-y-1">
        <label htmlFor="cycle_id" className="text-xs font-medium">Link to Review Cycle (optional)</label>
        <select
          id="cycle_id"
          name="cycle_id"
          className="w-full rounded border bg-background px-3 py-2 text-sm"
        >
          <option value="">No cycle — manual PIP</option>
          {cycles.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">Optionally link this PIP to a review cycle for tracking.</p>
      </div>

      <SubmitButton className="w-full" pendingLabel="Creating PIP...">
        Initiate PIP
      </SubmitButton>
    </form>
  )
}
