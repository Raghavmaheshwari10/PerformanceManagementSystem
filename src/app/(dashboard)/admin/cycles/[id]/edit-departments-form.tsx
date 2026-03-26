'use client'

import { useActionState } from 'react'
import { updateCycleDepartments } from './actions'
import type { ActionResult } from '@/lib/types'

interface Props {
  cycleId: string
  allDepartments: { id: string; name: string }[]
  selectedDepartmentIds: string[]
}

export function EditDepartmentsForm({ cycleId, allDepartments, selectedDepartmentIds }: Props) {
  const [state, formAction, pending] = useActionState(
    updateCycleDepartments.bind(null, cycleId),
    { data: null, error: null } as ActionResult,
  )

  return (
    <div className="glass p-4 space-y-3">
      <h2 className="font-semibold text-sm">Edit Department Scope</h2>
      <p className="text-xs text-white/50">
        Select departments to scope this cycle. Leave all unchecked for org-wide.
      </p>
      <form action={formAction}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {allDepartments.map(dept => (
            <label key={dept.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="department_ids"
                value={dept.id}
                defaultChecked={selectedDepartmentIds.includes(dept.id)}
              />
              {dept.name}
            </label>
          ))}
        </div>
        {state.error && (
          <p className="text-sm text-destructive mt-2">{state.error}</p>
        )}
        <button type="submit" disabled={pending} className="glow-button mt-3">
          {pending ? 'Saving…' : 'Save Departments'}
        </button>
      </form>
    </div>
  )
}
