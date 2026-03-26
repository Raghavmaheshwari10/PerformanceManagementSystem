import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { BellCurveChart } from '@/components/bell-curve-chart'
import { OverrideForm } from './override-form'
import { CalibrationActionsClient } from './calibration-actions-client'
import { CalculateScoresButton } from './calculate-scores-button'
import type { RatingTier, Cycle } from '@/lib/types'

interface AppraisalRow {
  id: string
  manager_rating: RatingTier | null
  final_rating: RatingTier | null
  payout_multiplier: number | null
  payout_amount: number | null
  snapshotted_variable_pay: number | null
  employee: { full_name: string; department: { name: string } | null } | null
}

export default async function CalibrationPage({ searchParams }: { searchParams: Promise<{ cycle?: string }> }) {
  await requireRole(['hrbp'])
  const { cycle: cycleId } = await searchParams

  if (!cycleId) return <p>Select a cycle from the overview page.</p>

  const [cycle, appraisals] = await Promise.all([
    prisma.cycle.findUnique({ where: { id: cycleId } }),
    prisma.appraisal.findMany({
      where: { cycle_id: cycleId },
      select: {
        id: true,
        manager_rating: true,
        final_rating: true,
        payout_multiplier: true,
        payout_amount: true,
        snapshotted_variable_pay: true,
        employee: {
          select: {
            full_name: true,
            department: { select: { name: true } },
          },
        },
      },
    }),
  ])

  const rows = appraisals as unknown as AppraisalRow[]
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
            {rows.map(a => (
              <tr key={a.id} className="border-b border-white/5">
                <td className="p-3">{a.employee?.full_name}</td>
                <td className="p-3 text-white/70">{a.employee?.department?.name ?? '—'}</td>
                <td className="p-3 text-white/70">{a.manager_rating}</td>
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
            ))}
          </tbody>
          {['locked', 'published'].includes(typedCycle?.status ?? '') && (
            <tfoot>
              <tr className="border-t border-white/8 font-semibold bg-white/[0.02]">
                <td colSpan={5} className="py-2 pr-3 text-right text-sm">Total payout</td>
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
