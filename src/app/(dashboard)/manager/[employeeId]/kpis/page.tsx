import { createClient } from '@/lib/supabase/server'
import { requireRole, requireManagerOwnership } from '@/lib/auth'
import { addKpi, deleteKpi } from '../../actions'
import { SubmitButton } from '@/components/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { KpiTemplatePicker } from '@/components/kpi-template-picker'
import type { Kpi, User } from '@/lib/types'

export default async function KpiSettingPage({
  params, searchParams,
}: {
  params: Promise<{ employeeId: string }>
  searchParams: Promise<{ cycle?: string; error?: string }>
}) {
  const user = await requireRole(["manager"])
  const { employeeId } = await params
  const { cycle: cycleId, error: pageError } = await searchParams

  await requireManagerOwnership(employeeId, user.id)

  const supabase = await createClient()
  const { data: employee } = await supabase.from("users").select("*").eq("id", employeeId).single()
  const { data: kpis } = await supabase.from("kpis").select("*").eq("cycle_id", cycleId ?? "").eq("employee_id", employeeId)

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">KPIs for {(employee as User)?.full_name}</h1>
        {cycleId && <div data-tour="template-picker"><KpiTemplatePicker cycleId={cycleId} employeeId={employeeId} /></div>}
      </div>

      {pageError && (
        <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{pageError}</p>
      )}

      <div className="space-y-2">
        {(!kpis || kpis.length === 0) && (
          <p className="text-muted-foreground">No KPIs set yet - add one below.</p>
        )}
        {(kpis as Kpi[] ?? []).map(kpi => (
          <div key={kpi.id} className="flex items-center justify-between rounded border p-3">
            <div>
              <p className="font-medium">{kpi.title}</p>
              <p className="text-sm text-muted-foreground">Weight: {kpi.weight}%</p>
            </div>
            <form action={deleteKpi.bind(null, kpi.id, employeeId) as unknown as (fd: FormData) => Promise<void>}>
              <Button variant="ghost" size="sm" type="submit">Remove</Button>
            </form>
          </div>
        ))}
      </div>

      <form action={addKpi as unknown as (fd: FormData) => Promise<void>} className="space-y-4 rounded border p-4">
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
          <Input id="weight" name="weight" type="number" min="1" max="100" data-tour="weight-field" />
        </div>
        <SubmitButton pendingLabel="Adding..." data-tour="add-kpi-btn">Add KPI</SubmitButton>
      </form>
    </div>
  )
}
