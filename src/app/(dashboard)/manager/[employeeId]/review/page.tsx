import { prisma } from '@/lib/prisma'
import { requireRole, requireManagerOwnership } from '@/lib/auth'
import { calculateEmployeeScore } from '@/lib/mis-scoring'
import { ReviewForm } from './review-form'
import type { User, Kpi, Kra, Review, Appraisal } from '@/lib/types'

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

  const [employee, kpisRaw, krasRaw, review, appraisal, misScore] = await Promise.all([
    prisma.user.findUnique({ where: { id: employeeId } }),
    cycleId
      ? prisma.kpi.findMany({
          where: { cycle_id: cycleId, employee_id: employeeId },
          include: { kra: true },
        })
      : Promise.resolve([]),
    cycleId
      ? prisma.kra.findMany({
          where: { cycle_id: cycleId, employee_id: employeeId },
          orderBy: { sort_order: 'asc' },
        })
      : Promise.resolve([]),
    cycleId
      ? prisma.review.findFirst({ where: { cycle_id: cycleId, employee_id: employeeId } })
      : Promise.resolve(null),
    cycleId
      ? prisma.appraisal.findFirst({ where: { cycle_id: cycleId, employee_id: employeeId } })
      : Promise.resolve(null),
    cycleId
      ? calculateEmployeeScore(employeeId, cycleId)
      : Promise.resolve(null),
  ])

  // Serialize Prisma Decimals to plain numbers
  const kpis = kpisRaw.map((k) => ({
    ...k,
    weight: k.weight !== null ? Number(k.weight) : null,
    kra: k.kra ? { ...k.kra, weight: k.kra.weight !== null ? Number(k.kra.weight) : null } : null,
  })) as unknown as (Kpi & { kra: Kra | null })[]

  const kras = krasRaw.map((k) => ({
    ...k,
    weight: k.weight !== null ? Number(k.weight) : null,
  })) as unknown as Kra[]

  // Group KPIs by KRA
  const hasKras = kras.length > 0
  const kpisByKra = new Map<string | null, typeof kpis>()
  for (const kpi of kpis) {
    const key = kpi.kra_id ?? null
    if (!kpisByKra.has(key)) kpisByKra.set(key, [])
    kpisByKra.get(key)!.push(kpi)
  }
  const ungroupedKpis = kpisByKra.get(null) ?? []

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

      {/* MIS Auto-Score Sidebar */}
      {misScore && (
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              MIS Auto-Score
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">{misScore.mis_score}%</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                misScore.suggested_rating === 'FEE' ? 'bg-emerald-500/20 text-emerald-400'
                : misScore.suggested_rating === 'EE' ? 'bg-blue-500/20 text-blue-400'
                : misScore.suggested_rating === 'ME' ? 'bg-amber-500/20 text-amber-400'
                : 'bg-red-500/20 text-red-400'
              }`}>
                Suggests: {misScore.suggested_rating}
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            {misScore.kpi_scores.map(k => (
              <div key={k.kpi_id} className="flex items-center justify-between text-sm rounded border border-white/5 bg-white/[0.02] px-3 py-1.5">
                <span className="text-white/70 truncate mr-2">{k.kpi_title}</span>
                <span className={`shrink-0 font-medium ${
                  k.achievement_pct >= 95 ? 'text-emerald-400' : k.achievement_pct >= 80 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {k.achievement_pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
            ) : !hasKras ? (
              /* Flat list when no KRAs exist (backwards compatible) */
              kpis.map(kpi => (
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
            ) : (
              /* Grouped by KRA */
              <div className="space-y-3">
                {kras.map(kra => {
                  const kraKpis = kpisByKra.get(kra.id) ?? []
                  if (kraKpis.length === 0) return null
                  const catColor =
                    kra.category === 'behaviour' ? 'bg-amber-500/15 text-amber-400'
                    : kra.category === 'learning' ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-primary/15 text-primary'
                  return (
                    <div key={kra.id} className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{kra.title}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${catColor}`}>
                          {kra.category}
                        </span>
                        {kra.weight != null && (
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground">{kra.weight}%</span>
                        )}
                      </div>
                      {kraKpis.map(kpi => (
                        <div key={kpi.id} className="rounded border bg-background p-2.5 ml-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium">{kpi.title}</p>
                            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">{kpi.weight}%</span>
                          </div>
                          {kpi.description && (
                            <p className="mt-1 text-xs text-muted-foreground">{kpi.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}
                {ungroupedKpis.length > 0 && (
                  <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm p-3 space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground">General</p>
                    {ungroupedKpis.map(kpi => (
                      <div key={kpi.id} className="rounded border bg-background p-2.5 ml-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{kpi.title}</p>
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">{kpi.weight}%</span>
                        </div>
                        {kpi.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{kpi.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
              defaultRating={(appraisal as Appraisal | null)?.manager_rating ?? misScore?.suggested_rating ?? undefined}
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
