import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CycleStatusBadge } from '@/components/cycle-status-badge'
import { DeadlineBanner } from '@/components/deadline-banner'
import { PayoutBreakdown } from '@/components/payout-breakdown'
import { CycleTimeline } from '@/components/cycle-timeline'
import { SelfReviewForm } from './self-review-form'
import type { Cycle, Kpi, Review, Appraisal } from '@/lib/types'

export default async function HrbpMyReviewPage() {
  const user = await requireRole(['hrbp'])
  const supabase = await createClient()

  // Check is_also_employee
  const { data: profile } = await supabase
    .from('users')
    .select('is_also_employee, full_name, manager_id')
    .eq('id', user.id)
    .single()

  if (!profile?.is_also_employee) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">My Review</h1>
        <p className="text-sm text-muted-foreground">
          You are not currently enrolled in review cycles.
          Contact your admin to enable this.
        </p>
      </div>
    )
  }

  // Find active cycle
  const { data: cycles } = await supabase
    .from('cycles')
    .select('*')
    .in('status', ['self_review', 'manager_review', 'calibrating', 'locked', 'published'])
    .order('created_at', { ascending: false })
    .limit(1)

  const cycle = (cycles as Cycle[])?.[0]

  if (!cycle) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">My Review</h1>
        <p className="text-sm text-muted-foreground">No active cycle.</p>
      </div>
    )
  }

  const [kpiRes, reviewRes, appraisalRes] = await Promise.all([
    supabase.from('kpis').select('*').eq('cycle_id', cycle.id).eq('employee_id', user.id),
    supabase.from('reviews').select('*').eq('cycle_id', cycle.id).eq('employee_id', user.id).maybeSingle(),
    supabase.from('appraisals').select('*').eq('cycle_id', cycle.id).eq('employee_id', user.id).maybeSingle(),
  ])

  const kpis = kpiRes.data as Kpi[] ?? []
  const review = reviewRes.data as Review | null
  const appraisal = appraisalRes.data as Appraisal | null
  const isSelfReview = cycle.status === 'self_review'
  const isPublished = cycle.status === 'published'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">My Review — {cycle.name}</h1>
        <CycleStatusBadge status={cycle.status} />
      </div>

      {isSelfReview && (
        <DeadlineBanner deadline={cycle.self_review_deadline} label="Self-review" />
      )}

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: KPI list */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your KPIs
          </h2>
          {kpis.length === 0 ? (
            <p className="rounded border border-dashed p-4 text-center text-sm text-muted-foreground">
              No KPIs assigned yet.
            </p>
          ) : (
            <div className="space-y-2">
              {kpis.map(kpi => (
                <div key={kpi.id} className="rounded border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{kpi.title}</p>
                      {kpi.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{kpi.description}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {kpi.weight}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right: Cycle timeline */}
        <section className="rounded border p-4">
          <CycleTimeline currentStatus={cycle.status} />
        </section>
      </div>

      {/* Self-review form — only shown during self_review phase and when not yet submitted */}
      {isSelfReview && review?.status !== 'submitted' && (
        <SelfReviewForm cycleId={cycle.id} review={review} />
      )}

      {/* Submitted review read-only view */}
      {review?.status === 'submitted' && !isPublished && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Self Assessment</h2>
          <div className="rounded border bg-muted/30 p-3 space-y-1">
            <p>Rating: <span className="font-bold">{review.self_rating}</span></p>
            <p className="whitespace-pre-wrap text-sm">{review.self_comments}</p>
          </div>
        </section>
      )}

      {/* Draft notice */}
      {review?.status === 'draft' && !isSelfReview && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Self Assessment</h2>
          <p className="text-yellow-600 text-sm">Draft saved — self-review phase has ended.</p>
        </section>
      )}

      {/* Published results */}
      {isPublished && appraisal && (
        <section className="rounded border bg-muted/30 p-4 space-y-2">
          <h2 className="text-lg font-semibold">Final Result</h2>
          <p>Final Rating: <span className="font-bold">{appraisal.final_rating}</span></p>
          {appraisal.payout_amount != null && (
            <PayoutBreakdown
              snapshottedVariablePay={appraisal.snapshotted_variable_pay ?? 0}
              rating={appraisal.final_rating ?? ''}
              individualMultiplier={appraisal.payout_multiplier ?? 0}
              businessMultiplier={cycle.business_multiplier ?? 1}
              payoutAmount={appraisal.payout_amount}
            />
          )}
        </section>
      )}
    </div>
  )
}
