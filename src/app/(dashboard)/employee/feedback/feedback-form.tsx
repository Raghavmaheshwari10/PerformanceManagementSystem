'use client'

import { useActionState, useEffect } from 'react'
import { sendFeedback } from './actions'
import { SubmitButton } from '@/components/submit-button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/lib/toast'
import type { ActionResult } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

interface Colleague { id: string; full_name: string }

export function FeedbackForm({ colleagues }: { colleagues: Colleague[] }) {
  const [state, action] = useActionState(sendFeedback, INITIAL)
  const { toast } = useToast()

  useEffect(() => {
    if (state === INITIAL) return
    if (state.error) toast.error(state.error)
    else toast.success('Feedback sent.')
  }, [state])

  return (
    <form action={action} className="space-y-3">
      {state.error && <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="to_user_id">To *</Label>
          <select id="to_user_id" name="to_user_id" required className="w-full rounded border bg-background px-3 py-1.5 text-sm">
            <option value="">Select colleague…</option>
            {colleagues.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="category">Category *</Label>
          <select id="category" name="category" required className="w-full rounded border bg-background px-3 py-1.5 text-sm">
            <option value="teamwork">Teamwork</option>
            <option value="leadership">Leadership</option>
            <option value="ownership">Ownership</option>
            <option value="communication">Communication</option>
            <option value="innovation">Innovation</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="visibility">Visibility</Label>
          <select id="visibility" name="visibility" className="w-full rounded border bg-background px-3 py-1.5 text-sm">
            <option value="recipient_and_manager">Recipient + Manager</option>
            <option value="public_team">Public to Team</option>
            <option value="private">Private (manager only)</option>
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="message">Message *</Label>
          <textarea id="message" name="message" rows={3} required className="w-full rounded border bg-background px-3 py-1.5 text-sm" placeholder="Describe the specific behavior or impact…" />
        </div>
      </div>
      <SubmitButton pendingLabel="Sending…">Send Feedback</SubmitButton>
    </form>
  )
}
