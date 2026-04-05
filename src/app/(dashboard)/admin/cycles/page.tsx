import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { CycleStatusBadge } from '@/components/cycle-status-badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { advanceCycleStatus } from '../actions'
import { getNextStatus } from '@/lib/cycle-machine'
import { CYCLE_STATUS_LABELS } from '@/lib/constants'
import { getScopedEmployeeWhere } from '@/lib/cycle-helpers'
import { DeleteCycleButton } from './delete-cycle-button'
import { RefreshCw } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'
import { TableSkeleton } from '@/components/skeletons'
import type { Cycle } from '@/lib/types'

interface CycleProgress {
  cycle: Cycle
  totalEmployees: number
  selfReviewsDone: number
  managerReviewsDone: number
  overdueManagerReviews: number
}

function daysUntil(d: Date | string | null) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

function ProgressRing({ pct, label, sub }: { pct: number; label: string; sub: string }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = circ * Math.min(pct / 100, 1)

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/40" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke="currentColor" strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          className={pct >= 100 ? 'text-green-500' : pct >= 50 ? 'text-primary' : 'text-amber-500'}
        />
        <text x="36" y="40" textAnchor="middle" className="text-xs font-bold" fill="currentColor" fontSize="13">
          {Math.round(pct)}%
        </text>
      </svg>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  )
}

export default async function AdminCyclesPage() {
  await requireRole(['admin'])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cycle Management</h1>
        <Link href="/admin/cycles/new" data-tour="create-cycle">
          <Button>Create Cycle</Button>
        </Link>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <CyclesContent />
      </Suspense>
    </div>
  )
}

async function CyclesContent() {
  const allCycles = await prisma.cycle.findMany({
    take: 50, // Paginate — avoid loading unbounded cycles
    orderBy: { created_at: 'desc' },
    include: { departments: { include: { department: true } } },
  })

  // For the most recent active cycle, fetch progress stats
  const activeCycle = allCycles.find(c => !['draft', 'published'].includes(c.status))
  let progress: CycleProgress | null = null

  if (activeCycle) {
    const empWhere = await getScopedEmployeeWhere(activeCycle.id)
    const [users, reviews, appraisals] = await Promise.all([
      prisma.user.findMany({
        where: empWhere,
        select: { id: true },
      }),
      prisma.review.findMany({
        where: { cycle_id: activeCycle.id },
        select: { employee_id: true, status: true },
      }),
      prisma.appraisal.findMany({
        where: { cycle_id: activeCycle.id },
        select: { employee_id: true, manager_submitted_at: true },
      }),
    ])

    const totalEmployees = users.length
    const selfReviewsDone = reviews.filter(r => r.status === 'submitted').length
    const managerReviewsDone = appraisals.filter(a => a.manager_submitted_at).length
    const days = daysUntil(activeCycle.manager_review_deadline)
    const overdueManagerReviews = days !== null && days < 0
      ? totalEmployees - managerReviewsDone
      : 0

    progress = { cycle: activeCycle as unknown as Cycle, totalEmployees, selfReviewsDone, managerReviewsDone, overdueManagerReviews }
  }

  return (
    <>
      {/* Progress dashboard for active cycle */}
      {progress && (
        <div className={cn(
          'rounded-lg border p-5 space-y-4',
          progress.overdueManagerReviews > 0 && 'border-destructive/40'
        )}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{progress.cycle.name} — Progress</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {progress.totalEmployees} employee{progress.totalEmployees !== 1 ? 's' : ''} in scope
              </p>
            </div>
            <CycleStatusBadge status={progress.cycle.status} />
          </div>

          {/* Overdue alert */}
          {progress.overdueManagerReviews > 0 && (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive font-medium">
              ⚠ {progress.overdueManagerReviews} manager review{progress.overdueManagerReviews !== 1 ? 's' : ''} overdue
            </div>
          )}

          {/* Progress rings */}
          <div className="flex gap-8 justify-center py-2">
            {progress.totalEmployees > 0 && (
              <>
                <ProgressRing
                  pct={(progress.selfReviewsDone / progress.totalEmployees) * 100}
                  label="Self Reviews"
                  sub={`${progress.selfReviewsDone} / ${progress.totalEmployees}`}
                />
                <ProgressRing
                  pct={(progress.managerReviewsDone / progress.totalEmployees) * 100}
                  label="Manager Reviews"
                  sub={`${progress.managerReviewsDone} / ${progress.totalEmployees}`}
                />
                <ProgressRing
                  pct={progress.cycle.status === 'published' ? 100 :
                        progress.cycle.status === 'locked' || progress.cycle.status === 'calibrating'
                        ? (progress.managerReviewsDone / progress.totalEmployees) * 80
                        : (progress.selfReviewsDone / progress.totalEmployees) * 40}
                  label="Overall"
                  sub={CYCLE_STATUS_LABELS[progress.cycle.status]}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Cycle table */}
      {allCycles.length === 0 ? (
        <EmptyState
          icon={<RefreshCw className="h-7 w-7" />}
          title="No review cycles yet"
          description="Create your first cycle to start the performance review process."
          action={{ label: '+ Create Cycle', href: '/admin/cycles/new' }}
        />
      ) : (
      <div className="glass overflow-hidden">
        <table className="w-full text-sm table-row-hover">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="p-3 text-left text-muted-foreground">Name</th>
              <th className="p-3 text-left text-muted-foreground">Status</th>
              <th className="p-3 text-left text-muted-foreground">Scope</th>
              <th className="p-3 text-left text-muted-foreground">Year</th>
              <th className="p-3 text-right text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {allCycles.map(cycle => {
              const next = getNextStatus(cycle.status)
              return (
                <tr key={cycle.id} className="border-b border-border">
                  <td className="p-3">
                    <Link href={`/admin/cycles/${cycle.id}`} className="text-primary hover:text-primary/80 font-medium">
                      {cycle.name}
                    </Link>
                  </td>
                  <td className="p-3"><span data-tour="cycle-status"><CycleStatusBadge status={cycle.status} /></span></td>
                  <td className="p-3">
                    {cycle.departments.length === 0 ? (
                      <span className="bg-muted/50 text-muted-foreground text-xs px-2 py-0.5 rounded-full">Org-wide</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {cycle.departments.map(cd => (
                          <span key={cd.department_id} className="bg-primary/15 text-primary text-xs px-2 py-0.5 rounded-full">
                            {cd.department.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">{cycle.year}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2">
                      {next && (
                        <div data-tour="advance-btn">
                          <form action={advanceCycleStatus.bind(null, cycle.id, cycle.status) as unknown as (fd: FormData) => Promise<void>}>
                            <Button variant="outline" size="sm" type="submit">
                              Advance to {CYCLE_STATUS_LABELS[next]}
                            </Button>
                          </form>
                        </div>
                      )}
                      <DeleteCycleButton cycleId={cycle.id} cycleName={cycle.name} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      )}
    </>
  )
}
