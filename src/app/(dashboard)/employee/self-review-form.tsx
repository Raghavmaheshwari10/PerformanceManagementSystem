'use client'

import { useActionState, useState, useRef, useEffect } from 'react'
import { submitSelfReview, saveDraftReview } from './actions'
import { SubmitButton } from '@/components/submit-button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RatingPillSelector, STANDARD_RATING_OPTIONS } from '@/components/rating-pill-selector'
import { RATING_TIERS, KPI_CATEGORY_LABELS, KRA_CATEGORY_STYLES as KRA_CAT_STYLES_IMPORT } from '@/lib/constants'
import { useToast } from '@/lib/toast'
import type { ActionResult, Kpi, Kra, Review, ReviewQuestionWithCompetency } from '@/lib/types'

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
  kpis: Kpi[]
  kras: Kra[]
  questions?: ReviewQuestionWithCompetency[]
  existingResponses?: Record<string, { rating_value: number | null; text_value: string | null }>
}

const STAR_LABELS = ['Poor', 'Below Average', 'Average', 'Good', 'Excellent']

const KRA_CATEGORY_STYLES = KRA_CAT_STYLES_IMPORT

export function SelfReviewForm({ cycleId, review, kpis, kras, questions = [], existingResponses = {} }: SelfReviewFormProps) {
  const [submitState, submitAction] = useActionState(submitSelfReview, INITIAL)
  const [draftState, draftAction] = useActionState(saveDraftReview, INITIAL)
  const [rating, setRating] = useState(review?.self_rating ?? '')
  const [kpiRatings, setKpiRatings] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const kpi of kpis) {
      if (kpi.self_rating) initial[kpi.id] = kpi.self_rating
    }
    return initial
  })
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

  // Group KPIs by KRA
  const kpisByKra = new Map<string | null, Kpi[]>()
  for (const kpi of kpis) {
    const key = kpi.kra_id ?? null
    if (!kpisByKra.has(key)) kpisByKra.set(key, [])
    kpisByKra.get(key)!.push(kpi)
  }
  const ungroupedKpis = kpisByKra.get(null) ?? []
  const hasKras = kras.length > 0

  return (
    <section className="rounded border p-4 space-y-6">
      <h2 className="text-lg font-semibold">Self Assessment</h2>
      <form className="space-y-6">
        <input type="hidden" name="cycle_id" value={cycleId} />
        <input type="hidden" name="self_rating" value={rating} />
        {/* Serialize per-KPI ratings as hidden inputs */}
        {Object.entries(kpiRatings).map(([kpiId, r]) => (
          <input key={kpiId} type="hidden" name={`kpi_rating_${kpiId}`} value={r} />
        ))}

        {error && (
          <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        {/* ── Per-KPI / KRA Ratings ── */}
        {kpis.length > 0 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold">Rate Your KPIs</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Rate your performance on each KPI and add optional comments.
              </p>
            </div>

            {hasKras ? (
              /* Grouped by KRA */
              <>
                {kras.map(kra => {
                  const kraKpis = kpisByKra.get(kra.id) ?? []
                  if (kraKpis.length === 0) return null
                  const catStyle = KRA_CATEGORY_STYLES[kra.category] ?? KRA_CATEGORY_STYLES.performance
                  return (
                    <div key={kra.id} className="glass p-4 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary tracking-wide">KRA</span>
                        <h4 className="font-semibold text-sm">{kra.title}</h4>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${catStyle.bg} ${catStyle.text}`}>
                          {KPI_CATEGORY_LABELS[kra.category] ?? kra.category}
                        </span>
                        {kra.weight && (
                          <span className="rounded-full bg-muted/50 px-2 py-0.5 text-xs font-semibold tabular-nums">
                            {String(kra.weight)}%
                          </span>
                        )}
                      </div>
                      {kra.description && (
                        <p className="text-xs text-muted-foreground">{kra.description}</p>
                      )}
                      <div className="space-y-3">
                        {kraKpis.map(kpi => (
                          <KpiRatingCard
                            key={kpi.id}
                            kpi={kpi}
                            rating={kpiRatings[kpi.id] ?? null}
                            onRatingChange={(v) => setKpiRatings(prev => ({ ...prev, [kpi.id]: v }))}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}

                {/* Ungrouped KPIs */}
                {ungroupedKpis.length > 0 && (
                  <div className="glass p-4 space-y-3">
                    <h4 className="font-semibold text-sm">General KPIs</h4>
                    <div className="space-y-3">
                      {ungroupedKpis.map(kpi => (
                        <KpiRatingCard
                          key={kpi.id}
                          kpi={kpi}
                          rating={kpiRatings[kpi.id] ?? null}
                          onRatingChange={(v) => setKpiRatings(prev => ({ ...prev, [kpi.id]: v }))}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Flat list */
              <div className="space-y-3">
                {kpis.map(kpi => (
                  <KpiRatingCard
                    key={kpi.id}
                    kpi={kpi}
                    rating={kpiRatings[kpi.id] ?? null}
                    onRatingChange={(v) => setKpiRatings(prev => ({ ...prev, [kpi.id]: v }))}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Overall Rating ── */}
        <div className="space-y-2 border-t border-border pt-4">
          <Label>Overall Self Rating</Label>
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
            <Label htmlFor="self_comments">Overall Comments</Label>
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
            rows={4}
            defaultValue={review?.self_comments ?? ''}
            placeholder="Summarize your key achievements and any challenges you overcame…"
            required
          />
        </div>

        {/* ── Competency Assessment ── */}
        {questions.length > 0 && (
          <div className="space-y-4 rounded border border-border p-4">
            <div>
              <h3 className="text-base font-semibold">Competency Assessment</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Rate yourself on each competency question below (1-5 scale).
              </p>
            </div>

            {questions.map(q => {
              const existing = existingResponses[q.id]
              return (
                <div key={q.id} className="space-y-2 border-t border-border pt-3">
                  <div>
                    <p className="text-sm font-medium">{q.question_text}</p>
                    {q.competency && (
                      <span className="inline-block mt-0.5 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                        {q.competency.name}
                      </span>
                    )}
                  </div>

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
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-sm font-semibold transition-all peer-checked:border-blue-500 peer-checked:bg-blue-500/20 peer-checked:text-blue-400 hover:bg-muted/30" title={STAR_LABELS[val - 1]}>
                              {val}
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground">1 = Poor, 5 = Excellent</p>
                    </div>
                  )}

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

        {review?.status === 'submitted' ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="size-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <p className="text-sm text-emerald-300 font-medium">Self-review submitted successfully. No further edits allowed.</p>
          </div>
        ) : (
          <div className="flex gap-2" data-tour="submit-review">
            <SubmitButton formAction={draftAction} variant="outline" pendingLabel="Saving…">
              Save Draft
            </SubmitButton>
            <SubmitButton formAction={submitAction} pendingLabel="Saving your review…">
              Submit
            </SubmitButton>
          </div>
        )}
      </form>
    </section>
  )
}

/* ── Per-KPI Rating Card ── */

function formatTarget(kpi: Kpi) {
  if (kpi.target == null) return null
  if (kpi.unit === 'boolean') return kpi.target ? 'Yes' : 'No'
  if (kpi.unit === 'percent' && Number(kpi.target) <= 200) return `${kpi.target}%`
  const v = Number(kpi.target)
  return v >= 1000 ? v.toLocaleString('en-IN') : String(kpi.target)
}

function KpiRatingCard({
  kpi,
  rating,
  onRatingChange,
}: {
  kpi: Kpi
  rating: string | null
  onRatingChange: (value: string) => void
}) {
  const target = formatTarget(kpi)
  return (
    <div className="glass-interactive p-3 space-y-2">
      {/* Row 1: Title + Weight + Rating */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm leading-snug">{kpi.title}</p>
            <span className="shrink-0 rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
              {String(kpi.weight)}%
            </span>
          </div>
          {kpi.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{kpi.description}</p>
          )}
        </div>
        <div className="shrink-0">
          <RatingPillSelector
            options={STANDARD_RATING_OPTIONS}
            value={rating}
            onChange={onRatingChange}
            label=""
          />
        </div>
      </div>

      {/* Row 2: Target + Achievement side by side */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Target</p>
          <div className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-1.5 text-sm tabular-nums">
            {target ?? <span className="text-muted-foreground italic">Not set</span>}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Achievement</p>
          <input
            type="number"
            step="any"
            name={`kpi_achievement_${kpi.id}`}
            defaultValue={kpi.achievement != null ? String(kpi.achievement) : ''}
            placeholder="Enter achievement"
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Row 3: Comments */}
      <Textarea
        name={`kpi_comments_${kpi.id}`}
        rows={2}
        defaultValue={kpi.self_comments ?? ''}
        placeholder="Comments on this KPI (optional)…"
        className="text-xs"
      />
    </div>
  )
}
