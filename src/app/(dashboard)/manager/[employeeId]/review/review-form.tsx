'use client'

import { useActionState, useState, useEffect } from 'react'
import { submitManagerRating } from '../../actions'
import { SubmitButton } from '@/components/submit-button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RatingPillSelector, STANDARD_RATING_OPTIONS } from '@/components/rating-pill-selector'
import { RATING_TIERS } from '@/lib/constants'
import { useToast } from '@/lib/toast'
import type { ActionResult, Kpi, Kra } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

const KRA_CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  performance: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  behaviour:   { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  learning:    { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
}

interface ReviewFormProps {
  cycleId: string
  employeeId: string
  kpis: Kpi[]
  kras: Kra[]
  defaultRating?: string
  defaultComments?: string
}

export function ReviewForm({ cycleId, employeeId, kpis, kras, defaultRating, defaultComments }: ReviewFormProps) {
  const [state, action] = useActionState(submitManagerRating, INITIAL)
  const [rating, setRating] = useState(defaultRating ?? '')
  const [kpiRatings, setKpiRatings] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const kpi of kpis) {
      if (kpi.manager_rating) initial[kpi.id] = kpi.manager_rating
    }
    return initial
  })
  const { toast } = useToast()

  const selectedTier = RATING_TIERS.find(t => t.code === rating)

  useEffect(() => {
    if (state === INITIAL) return
    if (state.error) toast.error(state.error)
    else toast.success('Rating submitted successfully.')
  }, [state])

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
    <form action={action} className="space-y-5">
      <input type="hidden" name="cycle_id" value={cycleId} />
      <input type="hidden" name="employee_id" value={employeeId} />
      <input type="hidden" name="manager_rating" value={rating} />
      {/* Serialize per-KPI ratings as hidden inputs */}
      {Object.entries(kpiRatings).map(([kpiId, r]) => (
        <input key={kpiId} type="hidden" name={`kpi_rating_${kpiId}`} value={r} />
      ))}

      {state.error && (
        <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      {/* ── Per-KPI Ratings ── */}
      {kpis.length > 0 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold">Rate Each KPI</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Rate the employee&apos;s performance on each KPI.
            </p>
          </div>

          {hasKras ? (
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
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${catStyle.bg} ${catStyle.text}`}>
                        {kra.category}
                      </span>
                      {kra.weight && (
                        <span className="rounded-full bg-muted/50 px-2 py-0.5 text-xs font-semibold tabular-nums">
                          {String(kra.weight)}%
                        </span>
                      )}
                    </div>
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
        <Label>Overall Rating</Label>
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
        <Label htmlFor="manager_comments">Overall Comments</Label>
        <Textarea
          id="manager_comments"
          name="manager_comments"
          rows={4}
          defaultValue={defaultComments ?? ''}
          placeholder="Provide specific, actionable feedback grounded in observed behaviours and KPI outcomes…"
          required
        />
      </div>

      <div data-tour="submit-review">
        <SubmitButton pendingLabel="Submitting your rating…">Submit Rating</SubmitButton>
      </div>
    </form>
  )
}

/* ── Per-KPI Rating Card for Manager ── */

function formatTarget(kpi: Kpi) {
  if (kpi.target == null) return null
  if (kpi.unit === 'percent') return `${kpi.target}%`
  if (kpi.unit === 'boolean') return kpi.target ? 'Yes' : 'No'
  return String(kpi.target)
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
    <div className="glass-interactive p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: KPI info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm leading-snug">{kpi.title}</p>
            {target && (
              <span className="shrink-0 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                Target: {target}
              </span>
            )}
            <span className="shrink-0 rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
              {String(kpi.weight)}%
            </span>
          </div>
          {kpi.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{kpi.description}</p>
          )}
          {kpi.self_rating && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Employee self-rated: <span className="font-semibold text-foreground">{kpi.self_rating}</span>
              {kpi.self_comments && <> — {kpi.self_comments}</>}
            </p>
          )}
        </div>
        {/* Right: Rating pills inline */}
        <div className="shrink-0">
          <RatingPillSelector
            options={STANDARD_RATING_OPTIONS}
            value={rating}
            onChange={onRatingChange}
            label=""
          />
        </div>
      </div>
      <Textarea
        name={`kpi_comments_${kpi.id}`}
        rows={2}
        defaultValue={kpi.manager_comments ?? ''}
        placeholder="Comments on this KPI (optional)…"
        className="text-xs mt-2"
      />
    </div>
  )
}
