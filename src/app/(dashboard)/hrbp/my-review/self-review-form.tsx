'use client'

import { useActionState, useState, useRef, useEffect } from 'react'
import { submitSelfReview, saveDraftReview } from './actions'
import { SubmitButton } from '@/components/submit-button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RatingPillSelector, STANDARD_RATING_OPTIONS } from '@/components/rating-pill-selector'
import { RATING_TIERS } from '@/lib/constants'
import { useToast } from '@/lib/toast'
import type { ActionResult, Review } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

const SENTENCE_STARTERS = [
  'I achieved…',
  'I improved [metric] from [X] to [Y] by…',
  'I took initiative to…',
  'I collaborated with [team] to…',
  'One challenge I overcame was…',
  'I learned that…',
]

interface SelfReviewFormProps {
  cycleId: string
  review: Review | null
}

export function SelfReviewForm({ cycleId, review }: SelfReviewFormProps) {
  const [submitState, submitAction] = useActionState(submitSelfReview, INITIAL)
  const [draftState, draftAction] = useActionState(saveDraftReview, INITIAL)
  const [rating, setRating] = useState(review?.self_rating ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { toast } = useToast()

  const error = submitState.error ?? draftState.error
  const selectedTier = RATING_TIERS.find(t => t.code === rating)

  useEffect(() => {
    if (submitState === INITIAL) return
    if (submitState.error) toast.error(submitState.error)
    else toast.success('Your self-review has been submitted.')
  }, [submitState])

  useEffect(() => {
    if (draftState === INITIAL) return
    if (draftState.error) toast.error(draftState.error)
    else toast.success('Draft saved.')
  }, [draftState])

  function appendStarter(starter: string) {
    const el = textareaRef.current
    if (!el) return
    const prev = el.value
    const sep = prev && !prev.endsWith('\n') ? '\n' : ''
    el.value = prev + sep + starter
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }

  return (
    <section className="rounded border p-4 space-y-4">
      <h2 className="text-lg font-semibold">Self Assessment</h2>
      <form className="space-y-4">
        <input type="hidden" name="cycle_id" value={cycleId} />
        <input type="hidden" name="self_rating" value={rating} />

        {error && (
          <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        {/* Rating pills */}
        <div className="space-y-2">
          <Label>Self Rating</Label>
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
          <div className="flex items-center justify-between">
            <Label htmlFor="self_comments">Comments</Label>
            <span className="text-xs text-muted-foreground">Sentence starters</span>
          </div>

          {/* Sentence starter chips */}
          <div className="flex flex-wrap gap-1.5">
            {SENTENCE_STARTERS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => appendStarter(s)}
                className="rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>

          <Textarea
            ref={textareaRef}
            id="self_comments"
            name="self_comments"
            rows={6}
            defaultValue={review?.self_comments ?? ''}
            placeholder="Describe your key achievements, how you met your KPIs, and any challenges you overcame…"
            required
          />
        </div>

        <div className="flex gap-2">
          <SubmitButton formAction={draftAction} variant="outline" pendingLabel="Saving…">
            Save Draft
          </SubmitButton>
          <SubmitButton formAction={submitAction} pendingLabel="Saving your review…">
            Submit
          </SubmitButton>
        </div>
      </form>
    </section>
  )
}
