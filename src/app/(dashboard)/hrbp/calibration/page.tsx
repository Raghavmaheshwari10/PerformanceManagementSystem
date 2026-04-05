import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { BellCurveChart } from '@/components/bell-curve-chart'
import { OverrideForm } from './override-form'
import { CalibrationActionsClient } from './calibration-actions-client'
import { CalculateScoresButton } from './calculate-scores-button'
import { TableSkeleton } from '@/components/skeletons'
import type { RatingTier, Cycle } from '@/lib/types'
import Link from 'next/link'

interface AppraisalRow {
  id: string
  manager_rating: RatingTier | null
  final_rating: RatingTier | null
  mis_score: number | null
  suggested_rating: RatingTier | null
  payout_multiplier: number | null
  payout_amount: number | null
  snapshotted_variable_pay: number | null
  is_exit_frozen: boolean
  exited_at: string | null
  proration_factor: number | null
  employee: { full_name: string; department_id: string | null; department: { name: string } | null } | null
}

export default async function CalibrationPage(props: { searchParams: Promise<{ cycle?: string; dept?: string }> }) {
  await requireRole(['hrbp'])
  const searchParams = await props.searchParams
  const cycleId = searchParams?.cycle

  if (!cycleId) return <p>Select a cycle from the overview page.</p>

  return (
    <div className="space-y-6">
      <Suspense fallback={<TableSkeleton />}>
        <CalibrationContent cycleId={cycleId} selectedDept={searchParams?.dept} />
      </Suspense>
    </div>
  )
}

async function CalibrationContent({ cycleId, selectedDept }: { cycleId: string; selectedDept?: string }) {
  const [cycle, allAppraisals, cycleDepts, allDepartments] = await Promise.all([
    prisma.cycle.findUnique({ where: { id: cycleId } }),
    prisma.appraisal.findMany({
      where: { cycle_id: cycleId },
      select: {
        id: true,
        manager_rating: true,
        final_rating: true,
        mis_score: true,
        suggested_rating: true,
        payout_multiplier: true,
        payout_amount: true,
        snapshotted_variable_pay: true,
        is_exit_frozen: true,
        exited_at: true,
        proration_factor: true,
        employee: {
          select: {
            full_name: true,
            department_id: true,
            department: { select: { name: true } },
          },
        },
      },
    }),
    prisma.cycleDepartment.findMany({
      where: { cycle_id: cycleId },
      select: { department_id: true, department: { select: { id: true, name: true } } },
    }),
    prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  // For dept-scoped cycles, only show tagged departments; for org-wide, show all
  const isDeptScoped = cycleDepts.length > 0
  const departments = isDeptScoped
    ? cycleDepts.map(cd => cd.department).sort((a, b) => a.name.localeCompare(b.name))
    : allDepartments
  const showDeptFilter = departments.length > 1

  const allRows = allAppraisals as unknown as AppraisalRow[]

  // Apply department filter
  const filteredRows = selectedDept
    ? allRows.filter(a => a.employee?.department_id === selectedDept)
    : allRows

  // Separate active and exited employees
  const rows = filteredRows.filter(a => !a.is_exit_frozen)
  const exitedRows = filteredRows.filter(a => a.is_exit_frozen)

  const distribution: Record<RatingTier, number> = { FEE: 0, EE: 0, ME: 0, SME: 0, BE: 0 }
  for (const a of rows) {
    const rating = a.final_rating ?? a.manager_rating
    if (rating) distribution[rating]++
  }

  const typedCycle = cycle as unknown as Cycle | null
  const isCalibrating = typedCycle?.status === 'calibrating'
  const isLocked = typedCycle?.status === 'locked'

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calibration — {typedCycle?.name}</h1>
        {isCalibrating && <CalculateScoresButton cycleId={cycleId} />}
      </div>

      {/* Department filter — only shown when multiple departments are in scope */}
      {showDeptFilter ? (
        <>
          <div className="flex items-center gap-3">
            <label htmlFor="dept-filter" className="text-sm text-muted-foreground">Filter by department:</label>
            <div className="relative">
              <select
                id="dept-filter"
                className="glass appearance-none rounded-lg border border-border bg-muted/30 px-3 py-1.5 pr-8 text-sm text-foreground backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                defaultValue={selectedDept ?? ''}
                data-cycle-id={cycleId}
              >
                <option value="">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted-foreground">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            {selectedDept && (
              <Link
                href={`/hrbp/calibration?cycle=${cycleId}`}
                className="text-xs text-primary hover:text-primary/80"
              >
                Clear filter
              </Link>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              Showing {rows.length} active{exitedRows.length > 0 ? ` + ${exitedRows.length} exited` : ''} of {allRows.length} appraisals
            </span>
          </div>
          <script
            dangerouslySetInnerHTML={{
              __html: `document.getElementById('dept-filter')?.addEventListener('change', function(e) {
                var val = e.target.value;
                var cycleId = e.target.getAttribute('data-cycle-id');
                var url = '/hrbp/calibration?cycle=' + encodeURIComponent(cycleId);
                if (val) url += '&dept=' + encodeURIComponent(val);
                window.location.href = url;
              });`,
            }}
          />
        </>
      ) : (
        <div className="flex items-center gap-3">
          {isDeptScoped && departments.length === 1 && (
            <span className="text-sm text-muted-foreground">Department: <span className="font-medium text-foreground">{departments[0].name}</span></span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            Showing {rows.length} active{exitedRows.length > 0 ? ` + ${exitedRows.length} exited` : ''} appraisals
          </span>
        </div>
      )}

      <div data-tour="bell-curve">
        <BellCurveChart distribution={distribution} total={rows.length} />
      </div>

      <div className="glass overflow-x-auto" data-tour="override-form">
        <table className="w-full text-sm table-row-hover min-w-[640px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Employee</th>
              <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Department</th>
              <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Manager Rating</th>
              <th className="p-3 text-right text-muted-foreground whitespace-nowrap">MIS Score</th>
              <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Suggested</th>
              <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Final Rating</th>
              {['locked', 'published'].includes(typedCycle?.status ?? '') && (
                <>
                  <th className="p-3 text-right text-muted-foreground whitespace-nowrap">Multiplier</th>
                  <th className="p-3 text-right text-muted-foreground whitespace-nowrap">Payout</th>
                </>
              )}
              {isCalibrating && <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Override</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(a => {
              const mismatch = a.suggested_rating && a.manager_rating && a.suggested_rating !== a.manager_rating
              return (
              <tr key={a.id} className={`border-b border-border ${mismatch ? 'bg-amber-500/[0.04]' : ''}`}>
                <td className="p-3">{a.employee?.full_name}</td>
                <td className="p-3 text-muted-foreground">{a.employee?.department?.name ?? '—'}</td>
                <td className="p-3 text-muted-foreground">{a.manager_rating}</td>
                <td className="p-3 text-right text-muted-foreground">{a.mis_score != null ? Number(a.mis_score).toFixed(1) + '%' : '—'}</td>
                <td className="p-3">
                  {a.suggested_rating ? (
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.suggested_rating !== a.manager_rating ? 'bg-amber-500/20 text-amber-400' : 'bg-muted/50 text-muted-foreground'
                    }`}>
                      {a.suggested_rating}
                    </span>
                  ) : '—'}
                </td>
                <td className="p-3 font-medium">{a.final_rating ?? a.manager_rating}</td>
                {['locked', 'published'].includes(typedCycle?.status ?? '') && (
                  <>
                    <td className="p-3 text-right text-muted-foreground">x{Number(a.payout_multiplier)?.toFixed(2) ?? '—'}</td>
                    <td className="p-3 text-right text-muted-foreground">Rs.{(Number(a.payout_amount) ?? 0).toLocaleString('en-IN')}</td>
                  </>
                )}
                {isCalibrating && (
                  <td className="p-3">
                    <OverrideForm
                      appraisalId={a.id}
                      cycleId={cycleId}
                      currentRating={a.final_rating ?? a.manager_rating}
                    />
                  </td>
                )}
              </tr>
              )
            })}
          </tbody>
          {['locked', 'published'].includes(typedCycle?.status ?? '') && (
            <tfoot>
              <tr className="border-t border-border font-semibold bg-muted/30">
                <td colSpan={7} className="py-2 pr-3 text-right text-sm">Total payout</td>
                <td className="py-2 pr-3 text-right text-sm">
                  Rs.{rows.reduce((s, a) => s + (Number(a.payout_amount) ?? 0), 0).toLocaleString('en-IN')}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Exited Employees Section ── */}
      {exitedRows.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            Exited Employees
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">{exitedRows.length}</span>
          </h2>
          <div className="glass overflow-x-auto opacity-80">
            <table className="w-full text-sm table-row-hover min-w-[560px]">
              <thead>
                <tr className="border-b border-border bg-red-500/5">
                  <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Employee</th>
                  <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Department</th>
                  <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Manager Rating</th>
                  <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Final Rating</th>
                  <th className="p-3 text-right text-muted-foreground whitespace-nowrap">Proration</th>
                  <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Exited On</th>
                  {['locked', 'published'].includes(typedCycle?.status ?? '') && (
                    <th className="p-3 text-right text-muted-foreground whitespace-nowrap">Payout</th>
                  )}
                  {isCalibrating && <th className="p-3 text-left text-muted-foreground whitespace-nowrap">Override</th>}
                </tr>
              </thead>
              <tbody>
                {exitedRows.map(a => (
                  <tr key={a.id} className="border-b border-border">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {a.employee?.full_name}
                        <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">Exited</span>
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{a.employee?.department?.name ?? '—'}</td>
                    <td className="p-3 text-muted-foreground">{a.manager_rating ?? '—'}</td>
                    <td className="p-3 font-medium">{a.final_rating ?? a.manager_rating ?? '—'}</td>
                    <td className="p-3 text-right text-muted-foreground">
                      {a.proration_factor != null ? `${(Number(a.proration_factor) * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {a.exited_at ? new Date(a.exited_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    {['locked', 'published'].includes(typedCycle?.status ?? '') && (
                      <td className="p-3 text-right text-muted-foreground">₹{(Number(a.payout_amount) ?? 0).toLocaleString('en-IN')}</td>
                    )}
                    {isCalibrating && (
                      <td className="p-3">
                        <OverrideForm
                          appraisalId={a.id}
                          cycleId={cycleId}
                          currentRating={a.final_rating ?? a.manager_rating}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CalibrationActionsClient
        cycleId={cycleId}
        canLock={isCalibrating}
        canPublish={isLocked}
        isLocked={isLocked}
      />
    </>
  )
}
