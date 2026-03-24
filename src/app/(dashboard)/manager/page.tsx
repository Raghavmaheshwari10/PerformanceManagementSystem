import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { DeadlineBanner } from '@/components/deadline-banner'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { User, Cycle } from '@/lib/types'

interface EmployeeStatus {
  employee: User
  kpiCount: number
  selfReviewStatus: 'submitted' | 'draft' | 'not_started'
  managerReviewStatus: 'submitted' | 'pending'
}

function daysUntil(d: Date | string | null): number | null {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

export default async function ManagerTeamPage() {
  const user = await requireRole(['manager'])

  const activeCycle = await prisma.cycle.findFirst({
    where: { status: { notIn: ['draft', 'published'] } },
    orderBy: { created_at: 'desc' },
  })

  const employees = await prisma.user.findMany({
    where: { manager_id: user.id, is_active: true },
    include: { department: true },
  })

  let statuses: EmployeeStatus[] = []
  if (activeCycle && employees.length > 0) {
    const employeeIds = employees.map(e => e.id)
    const [kpis, reviews, appraisals] = await Promise.all([
      prisma.kpi.findMany({
        where: { cycle_id: activeCycle.id, employee_id: { in: employeeIds } },
        select: { employee_id: true },
      }),
      prisma.review.findMany({
        where: { cycle_id: activeCycle.id, employee_id: { in: employeeIds } },
        select: { employee_id: true, status: true },
      }),
      prisma.appraisal.findMany({
        where: { cycle_id: activeCycle.id, employee_id: { in: employeeIds } },
        select: { employee_id: true, manager_submitted_at: true },
      }),
    ])

    const kpiCounts = new Map<string, number>()
    for (const k of kpis) {
      kpiCounts.set(k.employee_id, (kpiCounts.get(k.employee_id) ?? 0) + 1)
    }
    const reviewMap = new Map(reviews.map(r => [r.employee_id, r.status]))
    const appraisalMap = new Map(appraisals.map(a => [a.employee_id, a.manager_submitted_at]))

    statuses = employees.map(emp => ({
      employee: emp as unknown as User,
      kpiCount: kpiCounts.get(emp.id) ?? 0,
      selfReviewStatus: reviewMap.has(emp.id)
        ? (reviewMap.get(emp.id) === 'submitted' ? 'submitted' : 'draft')
        : 'not_started',
      managerReviewStatus: appraisalMap.get(emp.id) ? 'submitted' : 'pending',
    }))
  } else {
    statuses = employees.map(emp => ({
      employee: emp as unknown as User, kpiCount: 0,
      selfReviewStatus: 'not_started', managerReviewStatus: 'pending',
    }))
  }

  const totalReviews = statuses.length
  const submitted = statuses.filter(s => s.managerReviewStatus === 'submitted').length
  const remaining = totalReviews - submitted

  const deadline = activeCycle?.manager_review_deadline
  const daysLeft = daysUntil(deadline ?? null)
  const isOverdue = daysLeft !== null && daysLeft < 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">My Team</h1>
        {totalReviews > 0 && (
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{submitted}</span>/{totalReviews} reviews submitted
          </div>
        )}
      </div>

      {/* Overdue alert bar */}
      {isOverdue && remaining > 0 && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 flex items-center gap-3">
          <span className="text-destructive font-semibold text-sm">
            {remaining} review{remaining !== 1 ? 's' : ''} overdue
          </span>
          <span className="text-xs text-muted-foreground">
            Deadline was {Math.abs(daysLeft!)} day{Math.abs(daysLeft!) !== 1 ? 's' : ''} ago
          </span>
        </div>
      )}

      {!activeCycle && <p className="text-muted-foreground">No active review cycle.</p>}
      {activeCycle?.status === 'kpi_setting' && (
        <DeadlineBanner deadline={activeCycle.kpi_setting_deadline ? String(activeCycle.kpi_setting_deadline) : null} label="KPI setting" />
      )}
      {activeCycle?.status === 'manager_review' && !isOverdue && (
        <DeadlineBanner deadline={activeCycle.manager_review_deadline ? String(activeCycle.manager_review_deadline) : null} label="Manager review" />
      )}

      {employees.length === 0 && (
        <p className="text-muted-foreground">No direct reports found.</p>
      )}

      {/* Progress bar */}
      {totalReviews > 0 && activeCycle?.status === 'manager_review' && (
        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', isOverdue ? 'bg-destructive' : 'bg-primary')}
              style={{ width: `${totalReviews > 0 ? (submitted / totalReviews) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {submitted === totalReviews
              ? '✓ All reviews submitted!'
              : `${remaining} remaining${daysLeft !== null && daysLeft >= 0 ? ` · ${daysLeft}d left` : ''}`
            }
          </p>
        </div>
      )}

      {/* Employee cards */}
      {activeCycle && statuses.length > 0 && (
        <div className="space-y-2" data-tour="team-table">
          {statuses.map(({ employee: emp, kpiCount, selfReviewStatus, managerReviewStatus }, index) => {
            const reviewDone = managerReviewStatus === 'submitted'
            const selfDone   = selfReviewStatus === 'submitted'
            const needsReview = activeCycle.status === 'manager_review' && selfDone && !reviewDone
            const isFirstRow = index === 0

            return (
              <div
                key={emp.id}
                className={cn(
                  'rounded-lg border p-4 flex items-center justify-between gap-4',
                  needsReview && 'border-amber-400/60 bg-amber-50/40',
                  reviewDone && 'border-green-300/60 bg-green-50/30',
                )}
              >
                <div className="space-y-0.5">
                  <p className="font-medium">{emp.full_name}</p>
                  <p className="text-xs text-muted-foreground">{emp.department?.name ?? '—'}</p>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  {/* KPI count */}
                  <span className={cn(
                    'rounded-full px-2 py-0.5',
                    kpiCount > 0 ? 'bg-muted' : 'bg-destructive/10 text-destructive'
                  )}>
                    {kpiCount > 0 ? `${kpiCount} KPI${kpiCount !== 1 ? 's' : ''}` : 'No KPIs'}
                  </span>

                  {/* Self-review badge */}
                  <span className={cn(
                    'rounded-full px-2 py-0.5',
                    selfReviewStatus === 'submitted' ? 'bg-green-100 text-green-700'
                    : selfReviewStatus === 'draft' ? 'bg-blue-100 text-blue-700'
                    : 'bg-muted text-muted-foreground'
                  )}>
                    Self: {selfReviewStatus === 'submitted' ? 'Done' : selfReviewStatus === 'draft' ? 'Draft' : 'Pending'}
                  </span>

                  {/* Manager review badge */}
                  <span className={cn(
                    'rounded-full px-2 py-0.5',
                    reviewDone ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                  )}>
                    Mgr: {reviewDone ? 'Done' : 'Pending'}
                  </span>
                </div>

                <div className="flex gap-2 shrink-0">
                  <Link
                    href={`/manager/${emp.id}/kpis?cycle=${activeCycle.id}`}
                    className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
                    {...(isFirstRow ? { 'data-tour': 'kpi-button' } : {})}
                  >
                    KPIs
                  </Link>
                  <Link
                    href={`/manager/${emp.id}/review?cycle=${activeCycle.id}`}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      needsReview
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'border hover:bg-accent'
                    )}
                    {...(isFirstRow ? { 'data-tour': 'review-button' } : {})}
                  >
                    {reviewDone ? 'View' : 'Review'}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
