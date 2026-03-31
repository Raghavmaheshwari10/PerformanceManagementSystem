'use client'

import { useActionState } from 'react'
import { createUser } from '../actions'
import { SubmitButton } from '@/components/submit-button'

interface Props {
  departments: { id: string; name: string }[]
  managers: { id: string; full_name: string }[]
}

export function NewUserForm({ departments, managers }: Props) {
  const [state, action] = useActionState(createUser, null)

  return (
    <form action={action} className="space-y-4 rounded-lg border p-5">
      {state?.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium">Emp Code</label>
          <input name="emp_code" placeholder="e.g. EMB001" className="w-full rounded border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Full Name *</label>
          <input name="full_name" required className="w-full rounded border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Email *</label>
          <input name="email" type="email" required className="w-full rounded border bg-background px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium">Role *</label>
          <select name="role" required className="w-full rounded border bg-background px-3 py-2 text-sm">
            <option value="">Select role</option>
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="hrbp">HRBP</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Department</label>
          <select name="department_id" className="w-full rounded border bg-background px-3 py-2 text-sm">
            <option value="">None</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium">Designation</label>
          <input name="designation" className="w-full rounded border bg-background px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">Variable Pay (₹)</label>
          <input name="variable_pay" type="number" min="0" defaultValue={0} className="w-full rounded border bg-background px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Password</label>
        <input name="password" type="password" placeholder="Leave blank to send invite email" className="w-full rounded border bg-background px-3 py-2 text-sm" />
        <p className="text-[11px] text-muted-foreground">If blank, user receives an invite email to set their own password (72hr expiry).</p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium">Manager</label>
        <select name="manager_id" className="w-full rounded border bg-background px-3 py-2 text-sm">
          <option value="">None</option>
          {managers.map(m => (
            <option key={m.id} value={m.id}>{m.full_name}</option>
          ))}
        </select>
      </div>

      <SubmitButton className="w-full">Create User</SubmitButton>
    </form>
  )
}
