'use client'

import { useActionState, useState, useRef, useEffect } from 'react'
import { submitSelfReview, saveDraftReview } from './actions'
import { SubmitButton } from '@/components/submit-button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RatingPillSelector, STANDARD_RATING_OPTIONS } from '@/components/rating-pill-selector'
import { RATING_TIERS } from '@/lib/constants'
import { useToast } from '@/lib/toast'
import type { ActionResult, Review, ReviewQuestionWithCompetency } from '@/lib/types'

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
  questions?: ReviewQuestionWithCompetency[]
  existingResponses?: Record<string, { rating_value: number | null; text_value: string | null }>
}

const STAR_LABELS = ['Poor', 'Below Average', 'Average', 'Good', 'Excellent']

export function SelfReviewForm({ cycleId, review, questions = [], existingResponses = {} }: SelfReviewFormProps) {
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

        {/* Rating pills replace the old <select> */}
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

        {/* ── Competency Assessment ── */}
        {questions.length > 0 && (
          <div className="space-y-4 rounded border border-white/10 p-4">
            <div>
              <h3 className="text-base font-semibold">Competency Assessment</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Rate yourself on each competency question below (1-5 scale).
              </p>
            </div>

            {questions.map(q => {
              const existing = existingResponses[q.id]
              return (
                <div key={q.id} className="space-y-2 border-t border-white/5 pt-3">
                  <div>
                    <p className="text-sm font-medium">{q.question_text}</p>
                    {q.competency && (
                      <span className="inline-block mt-0.5 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                        {q.competency.name}
                      </span>
                    )}
                  </div>

                  {/* Rating (for rating or mixed answer_type) */}
                  {(q.answer_type === 'rating' || q.answer_type === 'mixed') && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Rating</Label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(val => (
                          <label key={val} className="group relative cursor-pointer">
                            <input
                              type="radio"
                              name={`response_${q.id}`}
                              value={val}
                              defaultChecked={existing?.rating_value === val}
                              className="peer sr-only"
                              required={q.is_required}
                            />
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-sm font-semibold transition-all peer-checked:border-blue-500 peer-checked:bg-blue-500/20 peer-checked:text-blue-400 hover:bg-white/5" title={STAR_LABELS[val - 1]}>
                              {val}
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground">1 = Poor, 5 = Excellent</p>
                    </div>
                  )}

                  {/* Text (for text or mixed answer_type) */}
                  {(q.answer_type === 'text' || q.answer_type === 'mixed') && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        {q.answer_type === 'text' ? 'Your response' : 'Additional comments (optional)'}
                      </Label>
                      <Textarea
                        name={`response_text_${q.id}`}
                        rows={2}
                        defaultValue={existing?.text_value ?? ''}
                        placeholder="Write your response..."
                        required={q.answer_type === 'text' && q.is_required}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex gap-2" data-tour="submit-review">
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
