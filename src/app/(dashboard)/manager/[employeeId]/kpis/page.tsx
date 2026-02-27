import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { addKpi, deleteKpi } from '../../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Kpi, User } from '@/lib/types'

export default async function KpiSettingPage({
  params, searchParams,
}: {
  params: Promise<{ employeeId: string }>
  searchParams: Promise<{ cycle?: string }>
}) {
  await requireRole(['manager'])
  const { employeeId } = await params
  const { cycle: cycleId } = await searchParams
  const supabase = await createClient()

  const { data: employee } = await supabase.from('users').select('*').eq('id', employeeId).single()
  const { data: kpis } = await supabase.from('kpis').select('*').eq('cycle_id', cycleId).eq('employee_id', employeeId)

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">KPIs for {(employee as User)?.full_name}</h1>

      <div className="space-y-2">
        {(kpis as Kpi[] ?? []).map(kpi => (
          <div key={kpi.id} className="flex items-center justify-between rounded border p-3">
            <div>
              <p className="font-medium">{kpi.title}</p>
              <p className="text-sm text-muted-foreground">Weight: {kpi.weight}%</p>
            </div>
            <form action={async () => { await deleteKpi(kpi.id, employeeId) }}>
              <Button variant="ghost" size="sm" type="submit">Remove</Button>
            </form>
          </div>
        ))}
      </div>

      <form action={async (fd: FormData) => { await addKpi(fd) }} className="space-y-4 rounded border p-4">
        <h2 className="text-lg font-semibold">Add KPI</h2>
        <input type="hidden" name="cycle_id" value={cycleId} />
        <input type="hidden" name="employee_id" value={employeeId} />
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weight">Weight (%)</Label>
          <Input id="weight" name="weight" type="number" min="0" max="100" />
        </div>
        <Button type="submit">Add KPI</Button>
      </form>
    </div>
  )
}
