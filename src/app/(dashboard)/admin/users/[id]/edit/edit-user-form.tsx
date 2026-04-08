'use client'
import { useActionState } from 'react'
import { updateUser, sendMagicLink, sendPasswordReset } from '../../actions'
import type { ActionResult } from '@/lib/types'
import { SubmitButton } from '@/components/submit-button'

interface EditableUser {
  id: string
  emp_code: string | null
  email: string
  full_name: string
  role: string
  department_id: string | null
  designation: string | null
  variable_pay: number | null
  manager_id: string | null
  is_also_employee: boolean
  is_active: boolean
}

interface Props {
  user: EditableUser
  departments: { id: string; name: string }[]
  managers: { id: string; full_name: string }[]
  assignedDeptIds: string[]
}

export function EditUserForm({ user, departments, managers, assignedDeptIds }: Props) {
  const [state, action] = useActionState(updateUser, null)
  const [magicState, magicAction] = useActionState<ActionResult<{ link: string }> | null, FormData>(sendMagicLink, null)
  const [resetState, resetAction] = useActionState(sendPasswordReset, null)

  const assignedSet = new Set(assignedDeptIds)

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4 rounded-lg border p-5">
        <input type="hidden" name="user_id" value={user.id} />

        {state?.error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            {state.error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">Emp Code</label>
            <input name="emp_code" defaultValue={user.emp_code ?? ''} placeholder="e.g. EMB001" className="w-full rounded border bg-background px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Full Name *</label>
            <input name="full_name" defaultValue={user.full_name} required className="w-full rounded border bg-background px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Email</label>
            <input value={user.email} disabled className="w-full rounded border px-3 py-2 text-sm bg-muted/40" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">Role *</label>
            <select name="role" defaultValue={user.role} required className="w-full rounded border bg-background px-3 py-2 text-sm">
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="hrbp">HRBP</option>
              <option value="department_head">Department Head</option>
              <option value="admin">Admin</option>
              <option value="founder">Founder</option>
              <option value="superadmin">Super Admin</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Department</label>
            <select name="department_id" defaultValue={user.department_id ?? ''} className="w-full rounded border bg-background px-3 py-2 text-sm">
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
            <input name="designation" defaultValue={user.designation ?? ''} className="w-full rounded border bg-background px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Variable Pay (₹)</label>
            <input name="variable_pay" type="number" min="0" defaultValue={user.variable_pay ?? 0} className="w-full rounded border bg-background px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">Manager</label>
          <select name="manager_id" defaultValue={user.manager_id ?? ''} className="w-full rounded border bg-background px-3 py-2 text-sm">
            <option value="">None</option>
            {managers.map(m => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>
        </div>

        {user.role === 'hrbp' && (
          <>
            <div className="space-y-2">
              <label className="text-xs font-medium">Assigned Departments</label>
              <div className="rounded border divide-y max-h-40 overflow-y-auto">
                {departments.map(d => (
                  <label key={d.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      name="hrbp_department_ids"
                      value={d.id}
                      defaultChecked={assignedSet.has(d.id)}
                    />
                    {d.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_also_employee"
                value="true"
                id="is_also_employee"
                defaultChecked={user.is_also_employee}
              />
              <label htmlFor="is_also_employee" className="text-sm">
                Also participates in review cycles (has own KPIs + self-review)
              </label>
            </div>
          </>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="is_active"
            value="true"
            id="is_active"
            defaultChecked={user.is_active}
          />
          <label htmlFor="is_active" className="text-sm">Active</label>
        </div>

        <SubmitButton className="w-full">Save Changes</SubmitButton>
      </form>

      {/* Auth controls */}
      <div className="rounded-lg border p-5 space-y-3">
        <h2 className="text-sm font-semibold">Auth Controls</h2>
        {(magicState?.error || resetState?.error) && (
          <div className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
            {magicState?.error || resetState?.error}
          </div>
        )}
        {magicState?.data?.link && (
          <div className="space-y-1.5">
            <p className="text-sm text-green-600 font-medium">Invite link generated &amp; email sent!</p>
            <p className="text-xs text-muted-foreground">Copy this link to share directly (expires in 72 hours):</p>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs break-all select-all font-mono cursor-text">
              {magicState.data.link}
            </div>
          </div>
        )}
        {(resetState?.data !== undefined && resetState?.data === null && !resetState?.error) && (
          <p className="text-sm text-green-600 font-medium bg-green-50 dark:bg-green-950/30 rounded-md px-3 py-2">
            Password reset email sent to {user.email}
          </p>
        )}
        <div className="flex gap-2">
          <form action={magicAction}>
            <input type="hidden" name="user_id" value={user.id} />
            <SubmitButton variant="outline" size="sm">Generate Invite Link</SubmitButton>
          </form>
          <form action={resetAction}>
            <input type="hidden" name="user_id" value={user.id} />
            <SubmitButton variant="outline" size="sm">Send Password Reset</SubmitButton>
          </form>
        </div>
        <p className="text-xs text-muted-foreground">
          <strong>Generate Invite Link</strong> — creates a 72hr invite link and emails it to {user.email}.<br/>
          <strong>Send Password Reset</strong> — sends a 1hr password reset link to {user.email}.
        </p>
      </div>
    </div>
  )
}
