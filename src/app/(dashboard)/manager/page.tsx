import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { getActiveCyclesForManager, batchGetStatusForEmployees, type CycleWithDepartments } from '@/lib/cycle-helpers'
import { DeadlineBanner } from '@/components/deadline-banner'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { User } from '@/lib/types'
import type { Cycle, CycleStatus } from '@prisma/client'

interface EmployeeStatus {
  employee: User
  kpiCount: number
  selfReviewStatus: 'submitted' | 'draft' | 'not_started'
  managerReviewStatus: 'submitted' | 'pending'
  resolvedStatus: CycleStatus
}

function daysUntil(d: Date | string | null): number | null {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

export default async function ManagerTeamPage() {
  const user = await requireRole(['manager'])

  // Get all relevant cycles for this manager (dept-scoped + org-wide)
  const { deptCycles, orgCycle } = await getActiveCyclesForManager(user.id)

  // Build a map: departmentId -> cycle (for employee assignment)
  const deptToCycle = new Map<string, Cycle>()
  // Build a map: cycleId -> department names (for section headers)
  const cycleDeptNames = new Map<string, string[]>()
  for (const c of deptCycles) {
    const names: string[] = []
    for (const cd of c.departments) {
      deptToCycle.set(cd.department_id, c)
      if (cd.department?.name) names.push(cd.department.name)
    }
    cycleDeptNames.set(c.id, names)
  }

  // All cycles as plain Cycle (dept-scoped first, then org-wide)
  const allCycles: Cycle[] = [...deptCycles, ...(orgCycle ? [orgCycle] : [])]
  const cycleIds = allCycles.map(c => c.id)
  const hasCycles = allCycles.length > 0

  // Get all active direct reports
  const employees = await prisma.user.findMany({
    where: { manager_id: user.id, is_active: true },
    include: { department: true },
    orderBy: { full_name: 'asc' },
  })

  // Group employees by their applicable cycle
  const employeeByCycle = new Map<string, typeof employees>()
  for (const emp of employees) {
    const cycle = (emp.department_id && deptToCycle.get(emp.department_id)) || orgCycle
    if (!cycle) continue
    const list = employeeByCycle.get(cycle.id) || []
    list.push(emp)
    employeeByCycle.set(cycle.id, list)
  }

  // All employees that belong to any cycle
  const allAssignedEmployees = Array.from(employeeByCycle.values()).flat()
  const employeeIds = allAssignedEmployees.map(e => e.id)

  // Fetch KPIs, Reviews, Appraisals for ALL cycle IDs at once
  let kpis: { employee_id: string; cycle_id: string }[] = []
  let reviews: { employee_id: string; cycle_id: string; status: string }[] = []
  let appraisals: { employee_id: string; cycle_id: string; manager_submitted_at: Date | null }[] = []

  if (hasCycles && employeeIds.length > 0) {
    ;[kpis, reviews, appraisals] = await Promise.all([
      prisma.kpi.findMany({
        where: { cycle_id: { in: cycleIds }, employee_id: { in: employeeIds } },
        select: { employee_id: true, cycle_id: true },
      }),
      prisma.review.findMany({
        where: { cycle_id: { in: cycleIds }, employee_id: { in: employeeIds } },
        select: { employee_id: true, cycle_id: true, status: true },
      }),
      prisma.appraisal.findMany({
        where: { cycle_id: { in: cycleIds }, employee_id: { in: employeeIds } },
        select: { employee_id: true, cycle_id: true, manager_submitted_at: true },
      }),
    ])
  }

  // Build per-cycle statuses
  type CycleSection = {
    cycle: Cycle
    statuses: EmployeeStatus[]
    submitted: number
    remaining: number
    totalReviews: number
    completionPct: number
    deadline: Date | null
    daysLeft: number | null
    isOverdue: boolean
    departmentNames: string[]
  }

  const cycleSections: CycleSection[] = []

  for (const cycle of allCycles) {
    const cycleEmployees = employeeByCycle.get(cycle.id) ?? []
    if (cycleEmployees.length === 0) continue

    const cycleEmployeeIds = new Set(cycleEmployees.map(e => e.id))

    // Build lookup maps scoped to this cycle
    const kpiCounts = new Map<string, number>()
    for (const k of kpis) {
      if (k.cycle_id === cycle.id && cycleEmployeeIds.has(k.employee_id)) {
        kpiCounts.set(k.employee_id, (kpiCounts.get(k.employee_id) ?? 0) + 1)
      }
    }
    const reviewMap = new Map<string, string>()
    for (const r of reviews) {
      if (r.cycle_id === cycle.id && cycleEmployeeIds.has(r.employee_id)) {
        reviewMap.set(r.employee_id, r.status)
      }
    }
    const appraisalMap = new Map<string, Date | null>()
    for (const a of appraisals) {
      if (a.cycle_id === cycle.id && cycleEmployeeIds.has(a.employee_id)) {
        appraisalMap.set(a.employee_id, a.manager_submitted_at)
      }
    }

    // Batch-resolve all employee statuses in 4 queries total
    const statusMap = await batchGetStatusForEmployees(
      cycle.id,
      cycleEmployees.map(e => e.id)
    )

    const statuses: EmployeeStatus[] = cycleEmployees.map((emp) => ({
      employee: emp as unknown as User,
      kpiCount: kpiCounts.get(emp.id) ?? 0,
      selfReviewStatus: reviewMap.has(emp.id)
        ? (reviewMap.get(emp.id) === 'submitted' ? 'submitted' : 'draft')
        : 'not_started',
      managerReviewStatus: appraisalMap.get(emp.id) ? 'submitted' : 'pending',
      resolvedStatus: statusMap.get(emp.id) ?? 'draft',
    }))

    const totalReviews = statuses.length
    const submitted = statuses.filter(s => s.managerReviewStatus === 'submitted').length
    const remaining = totalReviews - submitted
    const deadline = cycle.manager_review_deadline
    const dLeft = daysUntil(deadline ?? null)
    const isOverdue = dLeft !== null && dLeft < 0
    const completionPct = totalReviews > 0 ? Math.round((submitted / totalReviews) * 100) : 0

    // Department names for this cycle (empty if org-wide)
    const departmentNames = cycleDeptNames.get(cycle.id) ?? []

    cycleSections.push({
      cycle,
      statuses,
      submitted,
      remaining,
      totalReviews,
      completionPct,
      deadline,
      daysLeft: dLeft,
      isOverdue,
      departmentNames,
    })
  }

  // Overall totals for single-cycle mode (keep top-level summary identical to before)
  const isMultiCycle = cycleSections.length > 1

  return (
    <div className="space-y-6">
      {/* Page header */}
      <h1 className="text-2xl font-bold text-foreground">My Team</h1>

      {/* No active cycle empty state */}
      {!hasCycles && (
        <div className="glass flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted/30 p-4 mb-4">
            <svg className="h-8 w-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No Active Cycle</h3>
          <p className="text-sm text-muted-foreground max-w-sm">There&apos;s no review cycle in progress. Your team&apos;s reviews will appear here when the next cycle starts.</p>
        </div>
      )}

      {/* No direct reports empty state */}
      {employees.length === 0 && (
        <div className="glass flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted/30 p-4 mb-4">
            <svg className="h-8 w-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zm14 14v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No Direct Reports</h3>
          <p className="text-sm text-muted-foreground max-w-sm">No team members are assigned to you yet. Contact your admin to set up your team.</p>
        </div>
      )}

      {/* Render cycle sections */}
      {cycleSections.map((section, sectionIdx) => {
        const {
          cycle: activeCycle, statuses, submitted, remaining, totalReviews,
          completionPct, deadline, daysLeft, isOverdue, departmentNames,
        } = section

        return (
          <div key={activeCycle.id} className="space-y-4">
            {/* Cycle section header (only shown in multi-cycle mode) */}
            {isMultiCycle && (
              <div className="glass p-4 flex items-center gap-3">
                <h2 className="text-lg font-semibold text-foreground">{activeCycle.name}</h2>
                {departmentNames.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {departmentNames.map(name => (
                      <span
                        key={name}
                        className="glass-interactive rounded-full px-2.5 py-0.5 text-xs text-muted-foreground"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="glass-interactive rounded-full px-2.5 py-0.5 text-xs text-muted-foreground">
                    Org-wide
                  </span>
                )}
              </div>
            )}

            {/* Deadline banners — show if any employee in this section has the relevant resolved status */}
            {statuses.some(s => s.resolvedStatus === 'kpi_setting') && (
              <DeadlineBanner deadline={activeCycle.kpi_setting_deadline ? String(activeCycle.kpi_setting_deadline) : null} label="KPI setting" />
            )}
            {statuses.some(s => s.resolvedStatus === 'manager_review') && !isOverdue && (
              <DeadlineBanner deadline={activeCycle.manager_review_deadline ? String(activeCycle.manager_review_deadline) : null} label="Manager review" />
            )}

            {/* Summary bar */}
            {totalReviews > 0 && (
              <div
                className={cn(
                  'glass p-6',
                  isOverdue && remaining > 0 && 'shadow-[0_0_20px_oklch(0.6_0.25_25/0.3)]',
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Review Progress</p>
                    <p className="text-3xl font-bold text-foreground">
                      {submitted}
                      <span className="text-lg text-muted-foreground font-normal">/{totalReviews}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    {isOverdue && remaining > 0 ? (
                      <p className="text-sm font-semibold text-red-400">
                        {remaining} review{remaining !== 1 ? 's' : ''} overdue
                        <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                          Deadline was {Math.abs(daysLeft!)} day{Math.abs(daysLeft!) !== 1 ? 's' : ''} ago
                        </span>
                      </p>
                    ) : submitted === totalReviews ? (
                      <p className="text-sm font-semibold text-emerald-400">All reviews submitted</p>
                    ) : daysLeft !== null && daysLeft >= 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
                      </p>
                    ) : null}
                  </div>
                </div>
                {/* Animated progress bar */}
                <div className="h-2.5 w-full rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      isOverdue ? 'bg-red-500' : 'bg-[oklch(0.65_0.22_265)]',
                    )}
                    style={{
                      width: `${completionPct}%`,
                      animation: 'barGrow 1s ease-out',
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{completionPct}% complete</p>
              </div>
            )}

            {/* Team member bento grid */}
            {statuses.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-tour={sectionIdx === 0 ? 'team-table' : undefined}>
                {statuses.map(({ employee: emp, kpiCount, selfReviewStatus, managerReviewStatus, resolvedStatus }, index) => {
                  const reviewDone = managerReviewStatus === 'submitted'
                  const selfDone   = selfReviewStatus === 'submitted'
                  const needsReview = resolvedStatus === 'manager_review' && selfDone && !reviewDone
                  const isFirstRow = sectionIdx === 0 && index === 0

                  // Progress: self = 50%, manager = 50%
                  const selfPct = selfReviewStatus === 'submitted' ? 50
                    : selfReviewStatus === 'draft' ? 25 : 0
                  const mgrPct = reviewDone ? 50 : 0
                  const cardProgress = selfPct + mgrPct

                  // Avatar ring color
                  const ringColor = reviewDone
                    ? 'ring-emerald-500/70'
                    : needsReview
                      ? 'ring-amber-400/70'
                      : 'ring-border'

                  return (
                    <div
                      key={emp.id}
                      className={cn(
                        'glass p-5 flex flex-col gap-4',
                        needsReview && 'glass-glow',
                        reviewDone && '[box-shadow:0_0_12px_oklch(0.6_0.2_155/0.2)]',
                      )}
                      style={needsReview ? { boxShadow: '0 0 15px oklch(0.75 0.18 85 / 0.25)' } : undefined}
                    >
                      {/* Top: Avatar + Name */}
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'flex items-center justify-center w-11 h-11 rounded-full ring-2 text-sm font-semibold bg-muted/50 text-foreground shrink-0',
                            ringColor,
                          )}
                        >
                          {getInitials(emp.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{emp.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{emp.department?.name ?? '—'}</p>
                        </div>
                      </div>

                      {/* Status pills */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={cn(
                          'glass-interactive rounded-full px-2.5 py-1',
                          selfReviewStatus === 'submitted'
                            ? 'text-emerald-300'
                            : selfReviewStatus === 'draft'
                              ? 'text-blue-300'
                              : 'text-muted-foreground',
                        )}>
                          Self: {selfReviewStatus === 'submitted' ? '✓ Done' : selfReviewStatus === 'draft' ? 'Draft' : 'Pending'}
                        </span>
                        <span className={cn(
                          'glass-interactive rounded-full px-2.5 py-1',
                          reviewDone ? 'text-emerald-300' : 'text-muted-foreground',
                        )}>
                          Mgr: {reviewDone ? '✓ Done' : 'Pending'}
                        </span>
                        <span className={cn(
                          'glass-interactive rounded-full px-2.5 py-1',
                          kpiCount > 0 ? 'text-muted-foreground' : 'text-red-400',
                        )}>
                          {kpiCount > 0 ? `${kpiCount} KPI${kpiCount !== 1 ? 's' : ''}` : 'No KPIs'}
                        </span>
                      </div>

                      {/* Mini progress bar */}
                      <div>
                        <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[oklch(0.65_0.22_265)] transition-all"
                            style={{
                              width: `${cardProgress}%`,
                              animation: 'barGrow 0.8s ease-out',
                            }}
                          />
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 mt-auto">
                        <Link
                          href={`/manager/${emp.id}/goals?cycle=${activeCycle.id}`}
                          className="glass-interactive rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Goals
                        </Link>
                        <Link
                          href={`/manager/${emp.id}/kpis?cycle=${activeCycle.id}`}
                          className="glass-interactive rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          {...(isFirstRow ? { 'data-tour': 'kpi-button' } : {})}
                        >
                          KPIs
                        </Link>
                        <Link
                          href={`/manager/${emp.id}/review?cycle=${activeCycle.id}`}
                          className={cn(
                            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                            needsReview
                              ? 'glow-button'
                              : 'glass-interactive text-muted-foreground hover:text-foreground',
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
      })}
    </div>
  )
}
