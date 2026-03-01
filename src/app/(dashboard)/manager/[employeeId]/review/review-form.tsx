'use client'

import { useActionState, useState } from 'react'
import { submitManagerRating } from '../../actions'
import { SubmitButton } from '@/components/submit-button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RatingPillSelector, STANDARD_RATING_OPTIONS } from '@/components/rating-pill-selector'
import { RATING_TIERS } from '@/lib/constants'
import type { ActionResult } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

interface ReviewFormProps {
  cycleId: string
  employeeId: string
  defaultRating?: string
  defaultComments?: string
}

export function ReviewForm({ cycleId, employeeId, defaultRating, defaultComments }: ReviewFormProps) {
  const [state, action] = useActionState(submitManagerRating, INITIAL)
  const [rating, setRating] = useState(defaultRating ?? '')

  const selectedTier = RATING_TIERS.find(t => t.code === rating)

  return (
    <form action={action} className="space-y-4">
      <h2 className="text-base font-semibold">Your Assessment</h2>
      <input type="hidden" name="cycle_id" value={cycleId} />
      <input type="hidden" name="employee_id" value={employeeId} />
      <input type="hidden" name="manager_rating" value={rating} />

      {state.error && (
        <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <div className="space-y-2">
        <Label>Rating</Label>
        <RatingPillSelector
          options={STANDARD_RATING_OPTIONS}
          value={rating || null}
          onChange={setRating}
          label=""
        />
        {selectedTier && (
          <p className="text-xs text-muted-foreground">{selectedTier.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="manager_comments">Comments</Label>
        <Textarea
          id="manager_comments"
          name="manager_comments"
          rows={6}
          defaultValue={defaultComments ?? ''}
          placeholder="Provide specific, actionable feedback grounded in observed behaviours and KPI outcomes…"
          required
        />
      </div>

      <SubmitButton pendingLabel="Submitting…">Submit Rating</SubmitButton>
    </form>
  )
}
