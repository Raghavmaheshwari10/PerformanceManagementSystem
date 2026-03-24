'use client'

import { useActionState, useEffect } from 'react'
import { requestPeerReview } from './actions'
import { SubmitButton } from '@/components/submit-button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/lib/toast'
import type { ActionResult } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

interface Colleague { id: string; full_name: string }

export function PeerRequestForm({ cycleId, colleagues }: { cycleId: string; colleagues: Colleague[] }) {
  const [state, action] = useActionState(requestPeerReview, INITIAL)
  const { toast } = useToast()

  useEffect(() => {
    if (state === INITIAL) return
    if (state.error) toast.error(state.error)
    else toast.success('Peer review requested.')
  }, [state])

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="cycle_id" value={cycleId} />
      {state.error && <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
      <div className="space-y-1">
        <Label htmlFor="peer_user_id">Select Peer *</Label>
        <select id="peer_user_id" name="peer_user_id" required className="w-full rounded border bg-background px-3 py-1.5 text-sm">
          <option value="">Select colleague…</option>
          {colleagues.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </select>
      </div>
      <SubmitButton pendingLabel="Requesting…">Request Peer Review</SubmitButton>
    </form>
  )
}
