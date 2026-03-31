'use client'

import { useState, useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { sendManualNotification, type NotificationSummary } from './actions'
import type { User, ActionResult } from '@/lib/types'

const INITIAL: ActionResult<NotificationSummary> = { data: { sent: 0, scope: '' }, error: null }
const ROLES = ['employee', 'manager', 'hrbp'] as const

function SendButton() {
  const { pending } = useFormStatus()
  return <Button type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send Notification'}</Button>
}

export function NotificationForm({
  users,
  departments,
}: {
  users: Pick<User, 'id' | 'full_name' | 'email'>[]
  departments: string[]
}) {
  const [recipientType, setRecipientType] = useState<'individual' | 'role' | 'department' | 'everyone'>('everyone')
  const [state, action] = useActionState(sendManualNotification, INITIAL)

  return (
    <form action={action} className="space-y-5">
      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}
      {state.data && state.data.sent > 0 && (
        <p className="rounded-md bg-green-50 dark:bg-green-950/30 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          Sent to {state.data.sent} user{state.data.sent !== 1 ? 's' : ''} ({state.data.scope})
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="message">Message <span className="text-destructive">*</span></Label>
        <textarea
          id="message"
          name="message"
          rows={3}
          required
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Reminder: self-review deadline is Friday…"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="link">Link (optional)</Label>
        <Input id="link" name="link" placeholder="/employee or /admin/cycles/…" />
      </div>

      {/* Recipient type */}
      <div className="space-y-2">
        <Label>Recipients</Label>
        <div className="flex flex-wrap gap-2">
          {(['individual', 'role', 'department', 'everyone'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setRecipientType(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors border ${
                recipientType === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-muted border-input'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <input type="hidden" name="recipient_type" value={recipientType} />
      </div>

      {recipientType === 'individual' && (
        <div className="space-y-1.5">
          <Label htmlFor="user_id">User</Label>
          <select id="user_id" name="user_id" className="w-full rounded-md border bg-background px-3 py-1.5 text-sm">
            <option value="">— select user —</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
            ))}
          </select>
        </div>
      )}

      {recipientType === 'role' && (
        <div className="space-y-2">
          <Label>Roles</Label>
          {ROLES.map(r => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="roles" value={r} defaultChecked />
              <span>{r === 'hrbp' ? 'HRBP' : r.charAt(0).toUpperCase() + r.slice(1)}</span>
            </label>
          ))}
        </div>
      )}

      {recipientType === 'department' && (
        <div className="space-y-2">
          <Label>Departments</Label>
          <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border p-2">
            {departments.map(d => (
              <label key={d} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="departments" value={d} defaultChecked />
                <span>{d}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <SendButton />
    </form>
  )
}
