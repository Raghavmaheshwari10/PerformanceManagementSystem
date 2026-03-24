import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { CycleStatusBadge } from '@/components/cycle-status-badge'
import { DeadlineBanner } from '@/components/deadline-banner'
import { PayoutBreakdown } from '@/components/payout-breakdown'
import { CycleTimeline } from '@/components/cycle-timeline'
import { SelfReviewForm } from './self-review-form'
import type { Cycle, Kpi, Review, Appraisal } from '@/lib/types'

export default async function HrbpMyReviewPage() {
  const user = await requireRole(['hrbp'])

  // Check is_also_employee
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { is_also_employee: true, full_name: true, manager_id: true },
  })

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
  const cycle = await prisma.cycle.findFirst({
    where: {
      status: { in: ['self_review', 'manager_review', 'calibrating', 'locked', 'published'] },
    },
    orderBy: { created_at: 'desc' },
  })

  if (!cycle) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">My Review</h1>
        <p className="text-sm text-muted-foreground">No active cycle.</p>
      </div>
    )
  }

  const [kpis, review, appraisal] = await Promise.all([
    prisma.kpi.findMany({ where: { cycle_id: cycle.id, employee_id: user.id } }),
    prisma.review.findFirst({ where: { cycle_id: cycle.id, employee_id: user.id } }),
    prisma.appraisal.findFirst({ where: { cycle_id: cycle.id, employee_id: user.id } }),
  ])

  const typedCycle = cycle as unknown as Cycle
  const typedReview = review as unknown as Review | null
  const typedAppraisal = appraisal as unknown as Appraisal | null
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
        <DeadlineBanner deadline={cycle.self_review_deadline ? String(cycle.self_review_deadline) : null} label="Self-review" />
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
              {(kpis as unknown as Kpi[]).map(kpi => (
                <div key={kpi.id} className="rounded border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{kpi.title}</p>
                      {kpi.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{kpi.description}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {String(kpi.weight)}%
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
      {isSelfReview && typedReview?.status !== 'submitted' && (
        <SelfReviewForm cycleId={cycle.id} review={typedReview} />
      )}

      {/* Submitted review read-only view */}
      {typedReview?.status === 'submitted' && !isPublished && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Self Assessment</h2>
          <div className="rounded border bg-muted/30 p-3 space-y-1">
            <p>Rating: <span className="font-bold">{typedReview.self_rating}</span></p>
            <p className="whitespace-pre-wrap text-sm">{typedReview.self_comments}</p>
          </div>
        </section>
      )}

      {/* Draft notice */}
      {typedReview?.status === 'draft' && !isSelfReview && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Self Assessment</h2>
          <p className="text-yellow-600 text-sm">Draft saved — self-review phase has ended.</p>
        </section>
      )}

      {/* Published results */}
      {isPublished && typedAppraisal && (
        <section className="rounded border bg-muted/30 p-4 space-y-2">
          <h2 className="text-lg font-semibold">Final Result</h2>
          <p>Final Rating: <span className="font-bold">{typedAppraisal.final_rating}</span></p>
          {typedAppraisal.payout_amount != null && (
            <PayoutBreakdown
              snapshottedVariablePay={Number(typedAppraisal.snapshotted_variable_pay ?? 0)}
              rating={typedAppraisal.final_rating ?? ''}
              individualMultiplier={Number(typedAppraisal.payout_multiplier ?? 0)}
              businessMultiplier={Number(typedCycle.business_multiplier ?? 1)}
              payoutAmount={Number(typedAppraisal.payout_amount)}
            />
          )}
        </section>
      )}
    </div>
  )
}
