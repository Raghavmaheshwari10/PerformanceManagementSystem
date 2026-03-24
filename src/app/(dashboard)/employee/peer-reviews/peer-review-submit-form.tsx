'use client'

import { useActionState, useEffect } from 'react'
import { submitPeerReview } from './actions'
import { SubmitButton } from '@/components/submit-button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/lib/toast'
import type { ActionResult, PeerReviewRequest } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

const RATING_OPTIONS = [
  { value: 'FEE', label: 'Outstanding (FEE)' },
  { value: 'EE', label: 'Exceeds Expectations (EE)' },
  { value: 'ME', label: 'Meets Expectations (ME)' },
  { value: 'SME', label: 'Below Expectations (SME)' },
  { value: 'BE', label: 'Unsatisfactory (BE)' },
]

export function PeerReviewSubmitForm({ request }: { request: PeerReviewRequest }) {
  const [state, action] = useActionState(submitPeerReview, INITIAL)
  const { toast } = useToast()

  useEffect(() => {
    if (state === INITIAL) return
    if (state.error) toast.error(state.error)
    else toast.success('Peer review submitted.')
  }, [state])

  return (
    <div className="rounded border p-4 space-y-3">
      <p className="font-medium text-sm">Review for: {request.reviewee?.full_name ?? 'Unknown'}</p>
      <form action={action} className="space-y-3">
        <input type="hidden" name="request_id" value={request.id} />
        {state.error && <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
        <div className="space-y-1">
          <Label htmlFor={`rating-${request.id}`}>Rating</Label>
          <select id={`rating-${request.id}`} name="peer_rating" className="w-full rounded border bg-background px-3 py-1.5 text-sm">
            <option value="">Select rating…</option>
            {RATING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`comments-${request.id}`}>Comments</Label>
          <textarea id={`comments-${request.id}`} name="peer_comments" rows={3} className="w-full rounded border bg-background px-3 py-1.5 text-sm" placeholder="Share your observations about this person's work…" />
        </div>
        <SubmitButton pendingLabel="Submitting…">Submit Review</SubmitButton>
      </form>
    </div>
  )
}
