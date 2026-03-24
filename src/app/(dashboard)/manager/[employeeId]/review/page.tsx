import { prisma } from '@/lib/prisma'
import { requireRole, requireManagerOwnership } from '@/lib/auth'
import { ReviewForm } from './review-form'
import type { User, Kpi, Review, Appraisal } from '@/lib/types'

export default async function ManagerReviewPage({
  params, searchParams,
}: {
  params: Promise<{ employeeId: string }>
  searchParams: Promise<{ cycle?: string }>
}) {
  const user = await requireRole(['manager'])
  const { employeeId } = await params
  const { cycle: cycleId } = await searchParams

  await requireManagerOwnership(employeeId, user.id)

  if (cycleId) {
    const cycle = await prisma.cycle.findUnique({ where: { id: cycleId }, select: { id: true } })
    if (!cycle) return <p className="text-muted-foreground">Cycle not found.</p>
  }

  const [employee, kpis, review, appraisal] = await Promise.all([
    prisma.user.findUnique({ where: { id: employeeId } }),
    cycleId
      ? prisma.kpi.findMany({ where: { cycle_id: cycleId, employee_id: employeeId } })
      : Promise.resolve([]),
    cycleId
      ? prisma.review.findFirst({ where: { cycle_id: cycleId, employee_id: employeeId } })
      : Promise.resolve(null),
    cycleId
      ? prisma.appraisal.findFirst({ where: { cycle_id: cycleId, employee_id: employeeId } })
      : Promise.resolve(null),
  ])

  const submitted = !!(appraisal as Appraisal | null)?.manager_submitted_at

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Review: {(employee as unknown as User)?.full_name}</h1>
        {submitted && (
          <p className="mt-1 text-sm text-green-600 font-medium">
            ✓ Rating submitted: {(appraisal as Appraisal | null)?.manager_rating}
          </p>
        )}
      </div>

      {/* Side-by-side layout */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* LEFT — Employee's self-assessment (read-only, scrollable) */}
        <div className="rounded-lg border bg-muted/20 p-4 space-y-4 xl:max-h-[calc(100vh-12rem)] xl:overflow-y-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground sticky top-0 bg-muted/20 py-1">
            Employee Self-Assessment
          </h2>

          {/* KPIs */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">KPIs ({kpis.length})</p>
            {kpis.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No KPIs set for this cycle.</p>
            ) : (
              (kpis as unknown as Kpi[]).map(kpi => (
                <div key={kpi.id} className="rounded border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{kpi.title}</p>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">{kpi.weight}%</span>
                  </div>
                  {kpi.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{kpi.description}</p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Self-review */}
          {review ? (
            <div className="space-y-3">
              <div className="rounded border bg-background p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Self Rating</p>
                <span className="font-semibold">{(review as unknown as Review).self_rating ?? '—'}</span>
              </div>
              <div className="rounded border bg-background p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Self Comments</p>
                <p className="text-sm whitespace-pre-wrap">{(review as unknown as Review).self_comments || <span className="italic text-muted-foreground">No comments</span>}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              Employee has not submitted their self-review yet.
            </p>
          )}
        </div>

        {/* RIGHT — Manager's assessment form */}
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            Your Assessment
          </h2>
          {submitted ? (
            <div className="space-y-3">
              <div className="rounded border p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Your Rating</p>
                <span className="font-semibold text-green-700">{(appraisal as Appraisal | null)?.manager_rating}</span>
              </div>
              {(appraisal as Appraisal | null)?.manager_comments && (
                <div className="rounded border p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Your Comments</p>
                  <p className="text-sm whitespace-pre-wrap">{(appraisal as Appraisal | null)?.manager_comments}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Submitted. Contact your HRBP to request changes.
              </p>
            </div>
          ) : cycleId ? (
            <ReviewForm
              cycleId={cycleId}
              employeeId={employeeId}
              defaultRating={(appraisal as Appraisal | null)?.manager_rating ?? undefined}
              defaultComments={(appraisal as Appraisal | null)?.manager_comments ?? undefined}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No active cycle selected.</p>
          )}
        </div>
      </div>
    </div>
  )
}
