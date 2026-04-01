'use client'

import { useActionState, useState } from 'react'
import { createTarget, updateTarget } from './actions'
import { Plus, X, ChevronDown } from 'lucide-react'

interface Department { id: string; name: string }
interface Employee { id: string; full_name: string; email: string; department_id: string | null }

interface TargetFormProps {
  departments: Department[]
  employees: Employee[]
  fiscalYear: number
  editTarget?: {
    id: string
    metric_name: string
    category: string
    level: string
    annual_target: number
    unit: string
    department_id: string | null
    employee_id: string | null
    red_threshold: number
    amber_threshold: number
  }
  onClose?: () => void
}

export function TargetForm({ departments, employees, fiscalYear, editTarget, onClose }: TargetFormProps) {
  const action = editTarget ? updateTarget : createTarget
  const [state, formAction, pending] = useActionState(action, { data: null, error: null })
  const [level, setLevel] = useState(editTarget?.level ?? 'individual')
  const [deptId, setDeptId] = useState(editTarget?.department_id ?? '')

  // Filter employees by selected department
  const filteredEmployees = deptId
    ? employees.filter(e => e.department_id === deptId)
    : employees

  const isEdit = !!editTarget

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {isEdit ? 'Edit Target' : 'Add New Target'}
        </h3>
        {onClose && (
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <form action={formAction} className="space-y-4">
        {isEdit && <input type="hidden" name="target_id" value={editTarget.id} />}
        <input type="hidden" name="fiscal_year" value={fiscalYear} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Metric Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Metric Name *</label>
            <input
              name="metric_name"
              defaultValue={editTarget?.metric_name}
              required
              placeholder="e.g., Revenue Target"
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Category</label>
            <div className="relative">
              <select
                name="category"
                defaultValue={editTarget?.category ?? 'financial'}
                className="w-full appearance-none rounded-lg border border-border bg-muted/30 px-3 py-2 pr-8 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                <option value="financial">Financial</option>
                <option value="operational">Operational</option>
                <option value="people">People</option>
                <option value="customer">Customer</option>
                <option value="process">Process</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Level */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Level</label>
            <div className="relative">
              <select
                name="level"
                value={level}
                onChange={e => setLevel(e.target.value)}
                disabled={isEdit}
                className="w-full appearance-none rounded-lg border border-border bg-muted/30 px-3 py-2 pr-8 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
              >
                <option value="individual">Individual</option>
                <option value="department">Department</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Department */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Department {level === 'department' ? '*' : '(filter)'}
            </label>
            <div className="relative">
              <select
                name="department_id"
                value={deptId}
                onChange={e => setDeptId(e.target.value)}
                required={level === 'department'}
                className="w-full appearance-none rounded-lg border border-border bg-muted/30 px-3 py-2 pr-8 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                <option value="">— Select —</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          {/* Employee (only for individual level) */}
          {level === 'individual' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Employee *</label>
              <div className="relative">
                <select
                  name="employee_id"
                  defaultValue={editTarget?.employee_id ?? ''}
                  required
                  className="w-full appearance-none rounded-lg border border-border bg-muted/30 px-3 py-2 pr-8 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                >
                  <option value="">— Select employee —</option>
                  {filteredEmployees.map(e => (
                    <option key={e.id} value={e.id}>{e.full_name} ({e.email})</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Annual Target */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Annual Target *</label>
            <input
              name="annual_target"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={editTarget?.annual_target}
              required
              placeholder="e.g., 1000000"
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm tabular-nums focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {/* Unit */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Unit</label>
            <input
              name="unit"
              defaultValue={editTarget?.unit ?? 'number'}
              placeholder="e.g., INR, %, count"
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {/* Red Threshold */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Red Threshold (%)</label>
            <input
              name="red_threshold"
              type="number"
              step="1"
              min="0"
              max="100"
              defaultValue={editTarget?.red_threshold ?? 80}
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm tabular-nums focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {/* Amber Threshold */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Amber Threshold (%)</label>
            <input
              name="amber_threshold"
              type="number"
              step="1"
              min="0"
              max="100"
              defaultValue={editTarget?.amber_threshold ?? 95}
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm tabular-nums focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>

        {state.error && (
          <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{state.error}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="glow-button flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {pending ? 'Saving...' : isEdit ? 'Update Target' : 'Create Target'}
          </button>
          {onClose && (
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
