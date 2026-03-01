import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { BellCurveChart } from '@/components/bell-curve-chart'
import { OverrideForm } from './override-form'
import { CalibrationActionsClient } from './calibration-actions-client'
import type { RatingTier, Cycle } from '@/lib/types'

interface AppraisalRow {
  id: string
  manager_rating: RatingTier | null
  final_rating: RatingTier | null
  users: { full_name: string; department: string | null } | null
}

export default async function CalibrationPage({ searchParams }: { searchParams: Promise<{ cycle?: string }> }) {
  await requireRole(['hrbp'])
  const { cycle: cycleId } = await searchParams
  const supabase = await createClient()

  if (!cycleId) return <p>Select a cycle from the overview page.</p>

  const { data: cycle } = await supabase.from('cycles').select('*').eq('id', cycleId).single()
  const { data: appraisals } = await supabase
    .from('appraisals')
    .select('id, manager_rating, final_rating, users!appraisals_employee_id_fkey(full_name, department)')
    .eq('cycle_id', cycleId)

  const rows = (appraisals ?? []) as unknown as AppraisalRow[]
  const distribution: Record<RatingTier, number> = { FEE: 0, EE: 0, ME: 0, SME: 0, BE: 0 }
  for (const a of rows) {
    const rating = a.final_rating ?? a.manager_rating
    if (rating) distribution[rating]++
  }

  const typedCycle = cycle as Cycle | null
  const isCalibrating = typedCycle?.status === 'calibrating'
  const isLocked = typedCycle?.status === 'locked'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Calibration — {typedCycle?.name}</h1>

      <div data-tour="bell-curve">
        <BellCurveChart distribution={distribution} total={rows.length} />
      </div>

      <div className="rounded-md border" data-tour="override-form">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left">Employee</th>
              <th className="p-3 text-left">Department</th>
              <th className="p-3 text-left">Manager Rating</th>
              <th className="p-3 text-left">Final Rating</th>
              {isCalibrating && <th className="p-3 text-left">Override</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(a => (
              <tr key={a.id} className="border-b">
                <td className="p-3">{a.users?.full_name}</td>
                <td className="p-3">{a.users?.department}</td>
                <td className="p-3">{a.manager_rating}</td>
                <td className="p-3 font-medium">{a.final_rating ?? a.manager_rating}</td>
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

      <CalibrationActionsClient
        cycleId={cycleId}
        canLock={isCalibrating}
        canPublish={isLocked}
        isLocked={isLocked}
      />
    </div>
  )
}
