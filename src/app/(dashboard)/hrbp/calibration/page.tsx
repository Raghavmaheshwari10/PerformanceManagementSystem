import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { BellCurveChart } from '@/components/bell-curve-chart'
import { OverrideForm } from './override-form'
import { CalibrationActionsClient } from './calibration-actions-client'
import { CalculateScoresButton } from './calculate-scores-button'
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
  employee: { full_name: string; department_id: string | null; department: { name: string } | null } | null
}

export default async function CalibrationPage(props: { searchParams: Promise<{ cycle?: string; dept?: string }> }) {
  await requireRole(['hrbp'])
  const searchParams = await props.searchParams
  const cycleId = searchParams?.cycle
  const selectedDept = searchParams?.dept as string | undefined

  if (!cycleId) return <p>Select a cycle from the overview page.</p>

  const [cycle, allAppraisals, departments] = await Promise.all([
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
        employee: {
          select: {
            full_name: true,
            department_id: true,
            department: { select: { name: true } },
          },
        },
      },
    }),
    prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  const allRows = allAppraisals as unknown as AppraisalRow[]

  // Apply department filter
  const rows = selectedDept
    ? allRows.filter(a => a.employee?.department_id === selectedDept)
    : allRows

  const distribution: Record<RatingTier, number> = { FEE: 0, EE: 0, ME: 0, SME: 0, BE: 0 }
  for (const a of rows) {
    const rating = a.final_rating ?? a.manager_rating
    if (rating) distribution[rating]++
  }

  const typedCycle = cycle as unknown as Cycle | null
  const isCalibrating = typedCycle?.status === 'calibrating'
  const isLocked = typedCycle?.status === 'locked'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calibration — {typedCycle?.name}</h1>
        {isCalibrating && <CalculateScoresButton cycleId={cycleId} />}
      </div>

      {/* Department filter */}
      <div className="flex items-center gap-3">
        <label htmlFor="dept-filter" className="text-sm text-muted-foreground">Filter by department:</label>
        <div className="relative">
          <select
            id="dept-filter"
            className="glass appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 pr-8 text-sm text-white/90 backdrop-blur focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            defaultValue={selectedDept ?? ''}
            // Client-side navigation via inline script below
            data-cycle-id={cycleId}
          >
            <option value="" className="bg-neutral-900">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id} className="bg-neutral-900">{d.name}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-white/40">
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
          Showing {rows.length} of {allRows.length} appraisals
        </span>
      </div>

      {/* Inline script for select navigation */}
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

      <div data-tour="bell-curve">
        <BellCurveChart distribution={distribution} total={rows.length} />
      </div>

      <div className="glass overflow-hidden" data-tour="override-form">
        <table className="w-full text-sm table-row-hover">
          <thead>
            <tr className="border-b border-white/8 bg-white/[0.03]">
              <th className="p-3 text-left text-white/50">Employee</th>
              <th className="p-3 text-left text-white/50">Department</th>
              <th className="p-3 text-left text-white/50">Manager Rating</th>
              <th className="p-3 text-right text-white/50">MIS Score</th>
              <th className="p-3 text-left text-white/50">Suggested</th>
              <th className="p-3 text-left text-white/50">Final Rating</th>
              {['locked', 'published'].includes(typedCycle?.status ?? '') && (
                <>
                  <th className="p-3 text-right text-white/50">Multiplier</th>
                  <th className="p-3 text-right text-white/50">Payout</th>
                </>
              )}
              {isCalibrating && <th className="p-3 text-left text-white/50">Override</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(a => {
              const mismatch = a.suggested_rating && a.manager_rating && a.suggested_rating !== a.manager_rating
              return (
              <tr key={a.id} className={`border-b border-white/5 ${mismatch ? 'bg-amber-500/[0.04]' : ''}`}>
                <td className="p-3">{a.employee?.full_name}</td>
                <td className="p-3 text-white/70">{a.employee?.department?.name ?? '—'}</td>
                <td className="p-3 text-white/70">{a.manager_rating}</td>
                <td className="p-3 text-right text-white/70">{a.mis_score != null ? Number(a.mis_score).toFixed(1) + '%' : '—'}</td>
                <td className="p-3">
                  {a.suggested_rating ? (
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.suggested_rating !== a.manager_rating ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-white/70'
                    }`}>
                      {a.suggested_rating}
                    </span>
                  ) : '—'}
                </td>
                <td className="p-3 font-medium">{a.final_rating ?? a.manager_rating}</td>
                {['locked', 'published'].includes(typedCycle?.status ?? '') && (
                  <>
                    <td className="p-3 text-right text-white/70">x{Number(a.payout_multiplier)?.toFixed(3) ?? '—'}</td>
                    <td className="p-3 text-right text-white/70">Rs.{(Number(a.payout_amount) ?? 0).toLocaleString('en-IN')}</td>
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
              <tr className="border-t border-white/8 font-semibold bg-white/[0.02]">
                <td colSpan={7} className="py-2 pr-3 text-right text-sm">Total payout</td>
                <td className="py-2 pr-3 text-right text-sm">
                  Rs.{rows.reduce((s, a) => s + (Number(a.payout_amount) ?? 0), 0).toLocaleString('en-IN')}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <CalibrationActionsClient
        cycleId={cycleId}
        canLock={isCalibrating}
        canPublish={isLocked}
        isLocked={isLocked}
      />
    </div>
  )
}
