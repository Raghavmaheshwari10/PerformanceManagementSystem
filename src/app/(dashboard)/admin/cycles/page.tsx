import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { CycleStatusBadge } from '@/components/cycle-status-badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { advanceCycleStatus } from '../actions'
import { getNextStatus } from '@/lib/cycle-machine'
import { CYCLE_STATUS_LABELS } from '@/lib/constants'
import type { Cycle } from '@/lib/types'

interface CycleProgress {
  cycle: Cycle
  totalEmployees: number
  selfReviewsDone: number
  managerReviewsDone: number
  overdueManagerReviews: number
}

function daysUntil(d: string | null) {
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
  const supabase = await createClient()

  const { data: cycles } = await supabase
    .from('cycles')
    .select('*')
    .order('created_at', { ascending: false })

  const allCycles = (cycles as Cycle[]) ?? []

  // For the most recent active cycle, fetch progress stats
  const activeCycle = allCycles.find(c => !['draft', 'published'].includes(c.status))
  let progress: CycleProgress | null = null

  if (activeCycle) {
    const [usersRes, reviewsRes, appraisalsRes] = await Promise.all([
      supabase.from('users').select('id').eq('is_active', true).neq('role', 'admin').neq('role', 'hrbp'),
      supabase.from('reviews').select('employee_id, status').eq('cycle_id', activeCycle.id),
      supabase.from('appraisals').select('employee_id, manager_submitted_at').eq('cycle_id', activeCycle.id),
    ])

    const totalEmployees = usersRes.data?.length ?? 0
    const selfReviewsDone = (reviewsRes.data ?? []).filter(r => r.status === 'submitted').length
    const managerReviewsDone = (appraisalsRes.data ?? []).filter(a => a.manager_submitted_at).length
    const deadline = activeCycle.manager_review_deadline
    const days = daysUntil(deadline)
    const overdueManagerReviews = days !== null && days < 0
      ? totalEmployees - managerReviewsDone
      : 0

    progress = { cycle: activeCycle, totalEmployees, selfReviewsDone, managerReviewsDone, overdueManagerReviews }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cycle Management</h1>
        <Link href="/admin/cycles/new" data-tour="create-cycle">
          <Button>Create Cycle</Button>
        </Link>
      </div>

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
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Year</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {allCycles.map(cycle => {
              const next = getNextStatus(cycle.status)
              return (
                <tr key={cycle.id} className="border-b">
                  <td className="p-3">
                    <Link href={`/admin/cycles/${cycle.id}`} className="hover:underline font-medium">
                      {cycle.name}
                    </Link>
                  </td>
                  <td className="p-3"><span data-tour="cycle-status"><CycleStatusBadge status={cycle.status} /></span></td>
                  <td className="p-3">{cycle.year}</td>
                  <td className="p-3">
                    {next && (
                      <div data-tour="advance-btn">
                        <form action={advanceCycleStatus.bind(null, cycle.id, cycle.status) as unknown as (fd: FormData) => Promise<void>}>
                          <Button variant="outline" size="sm" type="submit">
                            Advance to {CYCLE_STATUS_LABELS[next]}
                          </Button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
