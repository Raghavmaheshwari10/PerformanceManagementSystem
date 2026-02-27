import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { BellCurveChart } from '@/components/bell-curve-chart'
import { overrideRating, lockCycle, publishCycle } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RATING_TIERS } from '@/lib/constants'
import type { RatingTier, Appraisal, Cycle } from '@/lib/types'

export default async function CalibrationPage({ searchParams }: { searchParams: Promise<{ cycle?: string }> }) {
  await requireRole(['hrbp'])
  const { cycle: cycleId } = await searchParams
  const supabase = await createClient()

  if (!cycleId) return <p>Select a cycle from the overview page.</p>

  const { data: cycle } = await supabase.from('cycles').select('*').eq('id', cycleId).single()
  const { data: appraisals } = await supabase
    .from('appraisals')
    .select('*, users!appraisals_employee_id_fkey(full_name, department)')
    .eq('cycle_id', cycleId)

  const distribution: Record<RatingTier, number> = { FEE: 0, EE: 0, ME: 0, SME: 0, BE: 0 }
  for (const a of appraisals ?? []) {
    const rating = (a as Appraisal).final_rating ?? (a as Appraisal).manager_rating
    if (rating) distribution[rating as RatingTier]++
  }

  const isCalibrating = (cycle as Cycle)?.status === 'calibrating'
  const isLocked = (cycle as Cycle)?.status === 'locked'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Calibration — {(cycle as Cycle)?.name}</h1>

      <BellCurveChart distribution={distribution} total={appraisals?.length ?? 0} />

      <div className="rounded-md border">
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
            {(appraisals ?? []).map((a: any) => (
              <tr key={a.id} className="border-b">
                <td className="p-3">{a.users?.full_name}</td>
                <td className="p-3">{a.users?.department}</td>
                <td className="p-3">{a.manager_rating}</td>
                <td className="p-3 font-medium">{a.final_rating ?? a.manager_rating}</td>
                {isCalibrating && (
                  <td className="p-3">
                    <form action={async (fd: FormData) => { await overrideRating({ data: null, error: null }, fd) }} className="flex gap-2">
                      <input type="hidden" name="appraisal_id" value={a.id} />
                      <input type="hidden" name="cycle_id" value={cycleId} />
                      <select name="final_rating" className="rounded border px-2 py-1 text-sm">
                        {RATING_TIERS.map(t => <option key={t.code} value={t.code}>{t.code}</option>)}
                      </select>
                      <Input name="justification" placeholder="Justification" className="text-sm" required />
                      <Button size="sm" type="submit">Save</Button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3">
        {isCalibrating && (
          <form action={async () => { await lockCycle(cycleId!) }}>
            <Button variant="destructive" type="submit">Lock Cycle</Button>
          </form>
        )}
        {isLocked && (
          <form action={async () => { await publishCycle(cycleId!) }}>
            <Button type="submit">Publish Cycle</Button>
          </form>
        )}
      </div>
    </div>
  )
}
