import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { CycleStatusBadge } from '@/components/cycle-status-badge'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { getNextStatus, getPreviousStatus, STATUS_ORDER, getTransitionLabel } from '@/lib/cycle-machine'
import { getScopedEmployeeWhere, getCycleDepartmentStatuses, getStatusForEmployee } from '@/lib/cycle-helpers'
import { DepartmentTransitionClient } from './department-transition-client'
import { EditDepartmentsForm } from './edit-departments-form'
import type { CycleStatus } from '@/lib/types'

function daysUntil(d: Date | string | null) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

export default async function CycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin'])
  const { id } = await params

  const cycle = await prisma.cycle.findUnique({
    where: { id },
    include: { departments: { include: { department: true } } },
  })
  if (!cycle) notFound()

  const isDeptScoped = cycle.departments.length > 0
  const deptStatuses = await getCycleDepartmentStatuses(cycle.id)

  const empWhere = await getScopedEmployeeWhere(cycle.id)
  const [users, reviews, appraisals, allDepartments, cycleEmployees] = await Promise.all([
    prisma.user.findMany({
      where: empWhere,
      select: { id: true, full_name: true, department_id: true, department: { select: { name: true } }, manager_id: true, manager: { select: { full_name: true } }, role: true },
    }),
    prisma.review.findMany({
      where: { cycle_id: id },
      select: { employee_id: true, status: true },
    }),
    prisma.appraisal.findMany({
      where: { cycle_id: id },
      select: { employee_id: true, manager_id: true, manager_submitted_at: true, final_rating: true },
    }),
    prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.cycleEmployee.findMany({
      where: { cycle_id: id },
      select: { employee_id: true, status_override: true, excluded: true },
    }),
  ])

  const isLockedOrPublished = cycle.status === 'locked' || cycle.status === 'published'
  const payouts = isLockedOrPublished ? await prisma.appraisal.findMany({
    where: { cycle_id: id, locked_at: { not: null } },
    select: {
      employee_id: true,
      final_rating: true,
      payout_multiplier: true,
      payout_amount: true,
      employee: { select: { full_name: true, department: { select: { name: true } } } },
    },
    orderBy: { payout_amount: 'desc' },
  }) : null

  const reviewMap = new Map(reviews.map(r => [r.employee_id, r]))
  const appraisalMap = new Map(appraisals.map(a => [a.employee_id, a]))
  const userMap = new Map(users.map(u => [u.id, u]))
  const empOverrideMap = new Map(cycleEmployees.map(ce => [ce.employee_id, ce]))

  const employees = users.filter(u => u.role === 'employee')
  const deadlineDays = daysUntil(cycle.manager_review_deadline)
  const isOverdue = deadlineDays !== null && deadlineDays < 0

  const next = getNextStatus(cycle.status)
  const prev = getPreviousStatus(cycle.status)

  // For dept-scoped cycles, compute effective status from the most advanced department
  const effectiveDeptStatus: CycleStatus | null = isDeptScoped && deptStatuses.length > 0
    ? deptStatuses.reduce((max, d) => {
        const maxIdx = STATUS_ORDER.indexOf(max)
        const dIdx = STATUS_ORDER.indexOf(d.status)
        return dIdx > maxIdx ? d.status : max
      }, deptStatuses[0].status)
    : null
  const deptPrev = effectiveDeptStatus ? getPreviousStatus(effectiveDeptStatus) : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link href="/admin/cycles" className="text-muted-foreground hover:underline text-sm">&larr; Cycles</Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{cycle.name}</h1>
            {!isDeptScoped && <CycleStatusBadge status={cycle.status} />}
            {!isDeptScoped ? (
              <span className="bg-muted/50 text-muted-foreground text-xs px-2 py-0.5 rounded-full">Org-wide</span>
            ) : (
              cycle.departments.map(cd => (
                <span key={cd.department_id} className="bg-primary/15 text-primary text-xs px-2 py-0.5 rounded-full">
                  {cd.department.name}
                </span>
              ))
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {cycle.quarter} {cycle.year}
            {cycle.manager_review_deadline && (
              <> &middot; Manager deadline: {new Date(cycle.manager_review_deadline).toLocaleDateString()}
                {isOverdue && <span className="ml-1 text-destructive font-medium">(overdue)</span>}
              </>
            )}
          </p>
        </div>

        {/* Org-wide advance/revert buttons (only for non-dept-scoped cycles) */}
        {!isDeptScoped && next && (
          <DepartmentTransitionClient
            cycleId={id}
            departmentId={null}
            departmentName="All Employees"
            currentStatus={cycle.status}
            nextStatus={next}
            previousStatus={prev}
          />
        )}
      </div>

      {/* ── Per-Department Pipeline ── */}
      {isDeptScoped && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Department Stages</h2>
            {(deptPrev ?? prev) && (
              <DepartmentTransitionClient
                cycleId={id}
                departmentId={null}
                departmentName="Entire Cycle"
                currentStatus={effectiveDeptStatus ?? cycle.status}
                previousStatus={deptPrev ?? prev}
              />
            )}
          </div>
          {deptStatuses.map(dept => {
            const deptNext = getNextStatus(dept.status)
            const deptEmps = employees.filter(e => e.department_id === dept.departmentId)
            const deptSelfDone = deptEmps.filter(e => reviewMap.get(e.id)?.status === 'submitted').length
            const deptMgrDone = deptEmps.filter(e => !!appraisalMap.get(e.id)?.manager_submitted_at).length

            return (
              <div key={dept.departmentId} className="glass-strong rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{dept.departmentName}</h3>
                    <CycleStatusBadge status={dept.status} />
                    <span className="text-xs text-muted-foreground">
                      {deptEmps.length} employee{deptEmps.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {deptNext && (
                    <DepartmentTransitionClient
                      cycleId={id}
                      departmentId={dept.departmentId}
                      departmentName={dept.departmentName}
                      currentStatus={dept.status}
                      nextStatus={deptNext}
                    />
                  )}
                </div>

                {/* Mini pipeline */}
                <div className="flex items-center gap-1">
                  {STATUS_ORDER.map((s, i) => {
                    const statusIdx = STATUS_ORDER.indexOf(dept.status)
                    const isPast = i < statusIdx
                    const isCurrent = i === statusIdx
                    return (
                      <div key={s} className="flex items-center gap-1 flex-1">
                        <div className={`size-2.5 rounded-full flex-shrink-0 ${
                          isPast ? 'bg-emerald-400' : isCurrent ? 'bg-primary' : 'bg-muted/50'
                        }`} />
                        {i < STATUS_ORDER.length - 1 && (
                          <div className={`h-px flex-1 ${isPast ? 'bg-emerald-400/50' : 'bg-muted/50'}`} />
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Draft</span>
                  <span>KPI</span>
                  <span>Self</span>
                  <span>Mgr</span>
                  <span>Cal</span>
                  <span>Lock</span>
                  <span>Pub</span>
                </div>

                {/* Stats */}
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Self reviews: {deptSelfDone}/{deptEmps.length}</span>
                  <span>Manager reviews: {deptMgrDone}/{deptEmps.length}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Per-employee table */}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left">Employee</th>
              <th className="p-3 text-left">Department</th>
              <th className="p-3 text-left">Manager</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Self Review</th>
              <th className="p-3 text-left">Manager Review</th>
              <th className="p-3 text-left">Rating</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => {
              const review = reviewMap.get(emp.id)
              const appraisal = appraisalMap.get(emp.id)
              const manager = emp.manager
              const selfDone = review?.status === 'submitted'
              const managerDone = !!appraisal?.manager_submitted_at
              const managerOverdue = isOverdue && !managerDone
              const empOverride = empOverrideMap.get(emp.id)
              const hasOverride = empOverride?.status_override != null

              // Resolve effective status for this employee
              const effectiveStatus: CycleStatus = empOverride?.status_override
                ?? (isDeptScoped && emp.department_id
                  ? (deptStatuses.find(d => d.departmentId === emp.department_id)?.status ?? cycle.status)
                  : cycle.status)

              return (
                <tr key={emp.id} className="border-t">
                  <td className="p-3 font-medium">{emp.full_name}</td>
                  <td className="p-3 text-muted-foreground">{emp.department?.name ?? '—'}</td>
                  <td className="p-3 text-muted-foreground">{manager?.full_name ?? '—'}</td>
                  <td className="p-3">
                    <CycleStatusBadge status={effectiveStatus} />
                    {hasOverride && (
                      <span className="ml-1 text-[10px] text-amber-400">(override)</span>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge variant={selfDone ? 'default' : 'secondary'}
                      className={selfDone ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : ''}>
                      {selfDone ? 'Submitted' : 'Pending'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant={managerDone ? 'default' : 'secondary'}
                      className={managerDone ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : managerOverdue ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : ''}>
                      {managerDone ? 'Done' : managerOverdue ? 'Overdue' : 'Pending'}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{appraisal?.final_rating ?? '—'}</td>
                </tr>
              )
            })}
            {employees.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No employees in scope</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Departments */}
      <EditDepartmentsForm
        cycleId={id}
        allDepartments={allDepartments}
        selectedDepartmentIds={cycle.departments.map(cd => cd.department_id)}
      />

      {/* Payout summary */}
      {isLockedOrPublished && payouts && payouts.length > 0 && (
        <div className="rounded-lg border p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Payout Summary</h2>
            {(() => {
              const totalPayout = payouts.reduce((s, p) => s + Number(p.payout_amount ?? 0), 0)
              return (
                <span className="text-sm text-muted-foreground">
                  Total: &rupee;{totalPayout.toLocaleString('en-IN')}
                  {cycle.total_budget ? ` / \u20B9${Number(cycle.total_budget).toLocaleString('en-IN')} budget` : ''}
                </span>
              )
            })()}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left pb-2 text-xs font-semibold text-muted-foreground">Employee</th>
                  <th className="text-left pb-2 text-xs font-semibold text-muted-foreground">Dept</th>
                  <th className="text-left pb-2 text-xs font-semibold text-muted-foreground">Rating</th>
                  <th className="text-right pb-2 text-xs font-semibold text-muted-foreground">Multiplier</th>
                  <th className="text-right pb-2 text-xs font-semibold text-muted-foreground">Payout</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map(p => (
                  <tr key={p.employee_id} className="border-b last:border-0">
                    <td className="py-2">{p.employee?.full_name}</td>
                    <td className="py-2 text-muted-foreground">{p.employee?.department?.name ?? '—'}</td>
                    <td className="py-2">{p.final_rating ?? '—'}</td>
                    <td className="py-2 text-right">&times;{Number(p.payout_multiplier)?.toFixed(2) ?? '—'}</td>
                    <td className="py-2 text-right font-medium">&rupee;{Number(p.payout_amount ?? 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
