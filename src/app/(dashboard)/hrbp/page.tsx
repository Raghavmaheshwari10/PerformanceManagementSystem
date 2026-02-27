import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { CycleStatusBadge } from '@/components/cycle-status-badge'
import Link from 'next/link'
import type { Cycle } from '@/lib/types'

function CycleCard({ cycle }: { cycle: Cycle }) {
  return (
    <div className="flex items-center justify-between rounded border p-4">
      <div className="space-y-1">
        <p className="font-medium">{cycle.name}</p>
        <p className="text-sm text-muted-foreground">{cycle.quarter} {cycle.year}</p>
        <CycleStatusBadge status={cycle.status} />
      </div>
      {['calibrating', 'locked'].includes(cycle.status) && (
        <Link href={`/hrbp/calibration?cycle=${cycle.id}`} className="text-blue-600 hover:underline text-sm">
          Calibrate
        </Link>
      )}
    </div>
  )
}

export default async function HrbpPage() {
  await requireRole(['hrbp'])
  const supabase = await createClient()
  const { data: cycles } = await supabase.from('cycles').select('*').order('created_at', { ascending: false })

  const allCycles = (cycles as Cycle[]) ?? []
  const active = allCycles.filter(c => c.status !== 'published')
  const published = allCycles.filter(c => c.status === 'published')

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Review Cycles</h1>

      {allCycles.length === 0 && (
        <p className="text-muted-foreground">No cycles yet.</p>
      )}

      {active.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Active</h2>
          <div className="grid gap-3">
            {active.map(cycle => <CycleCard key={cycle.id} cycle={cycle} />)}
          </div>
        </section>
      )}

      {published.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Published</h2>
          <div className="grid gap-3">
            {published.map(cycle => <CycleCard key={cycle.id} cycle={cycle} />)}
          </div>
        </section>
      )}
    </div>
  )
}
