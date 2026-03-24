import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { CycleStatusBadge } from '@/components/cycle-status-badge'
import { DeadlineBanner } from '@/components/deadline-banner'
import { SelfReviewForm } from './self-review-form'
import { PayoutBreakdown } from '@/components/payout-breakdown'
import { ActionInbox } from '@/components/action-inbox'
import { CycleTimeline } from '@/components/cycle-timeline'
import type { Cycle, Kpi, Review, Appraisal } from '@/lib/types'

export default async function EmployeeReviewPage() {
  const user = await requireRole(['employee'])

  const cycle = await prisma.cycle.findFirst({
    where: { status: { not: 'draft' } },
    orderBy: { created_at: 'desc' },
  })

  if (!cycle) return <p className="text-muted-foreground">No active review cycle.</p>

  const [kpis, review, appraisal] = await Promise.all([
    prisma.kpi.findMany({
      where: { cycle_id: cycle.id, employee_id: user.id },
    }),
    prisma.review.findFirst({
      where: { cycle_id: cycle.id, employee_id: user.id },
    }),
    prisma.appraisal.findFirst({
      where: { cycle_id: cycle.id, employee_id: user.id },
    }),
  ])

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

      {/* Zone 1: Action Inbox */}
      <div data-tour="action-inbox">
        <ActionInbox cycle={cycle as unknown as Cycle} kpis={kpis as unknown as Kpi[]} review={review as unknown as Review | null} />
      </div>

      {/* Zone 2: Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: KPI list */}
        <section className="space-y-3" data-tour="kpi-list">
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

      {/* Self-review form */}
      {isSelfReview && review?.status !== 'submitted' && (
        <div data-tour="self-review-form">
          <SelfReviewForm cycleId={cycle.id} review={review as unknown as Review | null} />
        </div>
      )}

      {/* Published results */}
      {isPublished && appraisal && (
        <section className="rounded border bg-muted/30 p-4 space-y-2">
          <h2 className="text-lg font-semibold">Final Result</h2>
          <p>Final Rating: <span className="font-bold">{appraisal.final_rating}</span></p>
          {appraisal.payout_amount != null && (
            <PayoutBreakdown
              snapshottedVariablePay={Number(appraisal.snapshotted_variable_pay ?? 0)}
              rating={appraisal.final_rating ?? ''}
              individualMultiplier={Number(appraisal.payout_multiplier ?? 0)}
              businessMultiplier={Number(cycle.business_multiplier ?? 1)}
              payoutAmount={Number(appraisal.payout_amount)}
            />
          )}
        </section>
      )}
    </div>
  )
}
