import { prisma } from '@/lib/prisma'
import { requireRole, requireManagerOwnership } from '@/lib/auth'
import { addKpi, deleteKpi, addKra, deleteKra } from '../../actions'
import { SubmitButton } from '@/components/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { KpiTemplatePicker } from '@/components/kpi-template-picker'
import { KraTemplatePicker } from '@/components/kra-template-picker'
import { KpiMisLink } from '@/components/kpi-mis-link'
// Types inferred from Prisma queries + Decimal serialization

const CATEGORY_STYLES: Record<string, string> = {
  performance: 'bg-primary/15 text-primary',
  behaviour: 'bg-amber-500/15 text-amber-400',
  learning: 'bg-emerald-500/15 text-emerald-400',
}

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

  const [employee, rawKpis, rawKras] = await Promise.all([
    prisma.user.findUnique({ where: { id: employeeId } }),
    cycleId
      ? prisma.kpi.findMany({ where: { cycle_id: cycleId, employee_id: employeeId }, include: { kra: true, mis_mappings: { include: { aop_target: true } } } })
      : [],
    cycleId
      ? prisma.kra.findMany({ where: { cycle_id: cycleId, employee_id: employeeId }, orderBy: { sort_order: 'asc' } })
      : [],
  ])

  // Serialize Prisma Decimal to plain numbers for rendering
  const kpis = rawKpis.map(k => ({
    ...k,
    weight: k.weight ? Number(k.weight) : null,
    kra: k.kra ? { ...k.kra, weight: k.kra.weight ? Number(k.kra.weight) : null } : null,
    mis_mappings: ('mis_mappings' in k && Array.isArray(k.mis_mappings)) ? k.mis_mappings : [],
  }))
  const kras = rawKras.map(k => ({
    ...k,
    weight: k.weight ? Number(k.weight) : null,
  }))

  // Helper: extract first MIS mapping for a KPI (if any)
  function getMisMapping(kpi: typeof kpis[number]) {
    const m = kpi.mis_mappings?.[0]
    if (!m) return null
    return {
      id: m.id,
      aopTargetId: m.aop_target_id,
      metricName: m.aop_target.metric_name,
      formula: m.score_formula,
    }
  }

  // Group KPIs by kra_id
  const kpisByKra = new Map<string | null, typeof kpis>()
  for (const kpi of kpis) {
    const key = kpi.kra_id
    const list = kpisByKra.get(key) || []
    list.push(kpi)
    kpisByKra.set(key, list)
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">KPIs for {employee?.full_name}</h1>
        {cycleId && (
          <div className="flex items-center gap-2" data-tour="template-picker">
            <KraTemplatePicker cycleId={cycleId} employeeId={employeeId} />
            <KpiTemplatePicker cycleId={cycleId} employeeId={employeeId} />
          </div>
        )}
      </div>

      {pageError && (
        <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{pageError}</p>
      )}

      {/* KRA Sections */}
      {(kras).map(kra => {
        const kraKpis = kpisByKra.get(kra.id) || []
        const catStyle = CATEGORY_STYLES[kra.category] || CATEGORY_STYLES.performance
        return (
          <section key={kra.id} className="glass rounded-xl p-5 space-y-4">
            {/* KRA Header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold">{kra.title}</h2>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${catStyle}`}>
                  {kra.category}
                </span>
                {kra.weight != null && (
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {String(kra.weight)}%
                  </span>
                )}
              </div>
              <form action={deleteKra.bind(null, kra.id, employeeId) as unknown as (fd: FormData) => Promise<void>}>
                <Button variant="ghost" size="sm" type="submit" className="text-destructive hover:text-destructive">
                  Remove KRA
                </Button>
              </form>
            </div>

            {kra.description && (
              <p className="text-sm text-muted-foreground">{kra.description}</p>
            )}

            {/* KPIs under this KRA */}
            <div className="space-y-2">
              {kraKpis.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No KPIs under this KRA yet.</p>
              )}
              {kraKpis.map(kpi => (
                <div key={kpi.id} className="glass-interactive flex items-center justify-between rounded-lg p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{kpi.title}</p>
                    <KpiMisLink
                      kpiId={kpi.id}
                      kpiTitle={kpi.title}
                      employeeId={employeeId}
                      currentMapping={getMisMapping(kpi)}
                    />
                    {kpi.weight != null && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-muted-foreground">
                        Weight: {String(kpi.weight)}%
                      </span>
                    )}
                  </div>
                  <form action={deleteKpi.bind(null, kpi.id, employeeId) as unknown as (fd: FormData) => Promise<void>}>
                    <Button variant="ghost" size="sm" type="submit">Remove</Button>
                  </form>
                </div>
              ))}
            </div>

            {/* Add KPI under this KRA */}
            {cycleId && (
              <form action={addKpi as unknown as (fd: FormData) => Promise<void>} className="glass rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold">Add KPI under this KRA</h3>
                <input type="hidden" name="cycle_id" value={cycleId} />
                <input type="hidden" name="employee_id" value={employeeId} />
                <input type="hidden" name="kra_id" value={kra.id} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor={`kpi-title-${kra.id}`}>Title</Label>
                    <Input id={`kpi-title-${kra.id}`} name="title" required placeholder="KPI title" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`kpi-weight-${kra.id}`}>Weight (%)</Label>
                    <Input id={`kpi-weight-${kra.id}`} name="weight" type="number" min="1" max="100" placeholder="e.g. 20" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`kpi-desc-${kra.id}`}>Description</Label>
                  <Input id={`kpi-desc-${kra.id}`} name="description" placeholder="Optional description" />
                </div>
                <SubmitButton pendingLabel="Adding...">Add KPI</SubmitButton>
              </form>
            )}
          </section>
        )
      })}

      {/* Ungrouped KPIs (kra_id = null) */}
      {(() => {
        const ungrouped = kpisByKra.get(null) || []
        if (ungrouped.length === 0 && kras.length > 0) return null
        return (
          <section className="glass rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-semibold">General KPIs</h2>
            <p className="text-sm text-muted-foreground">KPIs not assigned to any Key Result Area.</p>
            <div className="space-y-2">
              {ungrouped.length === 0 && (kras).length === 0 && (
                <p className="text-muted-foreground">No KPIs set yet - add one below.</p>
              )}
              {ungrouped.map(kpi => (
                <div key={kpi.id} className="glass-interactive flex items-center justify-between rounded-lg p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{kpi.title}</p>
                    <KpiMisLink
                      kpiId={kpi.id}
                      kpiTitle={kpi.title}
                      employeeId={employeeId}
                      currentMapping={getMisMapping(kpi)}
                    />
                    {kpi.weight != null && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-muted-foreground">
                        Weight: {String(kpi.weight)}%
                      </span>
                    )}
                  </div>
                  <form action={deleteKpi.bind(null, kpi.id, employeeId) as unknown as (fd: FormData) => Promise<void>}>
                    <Button variant="ghost" size="sm" type="submit">Remove</Button>
                  </form>
                </div>
              ))}
            </div>

            {/* Add KPI (no KRA) */}
            {cycleId && (
              <form action={addKpi as unknown as (fd: FormData) => Promise<void>} className="glass rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold">Add KPI</h3>
                <input type="hidden" name="cycle_id" value={cycleId} />
                <input type="hidden" name="employee_id" value={employeeId} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="general-kpi-title">Title</Label>
                    <Input id="general-kpi-title" name="title" required placeholder="KPI title" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="general-kpi-weight">Weight (%)</Label>
                    <Input id="general-kpi-weight" name="weight" type="number" min="1" max="100" placeholder="e.g. 20" data-tour="weight-field" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="general-kpi-desc">Description</Label>
                  <Input id="general-kpi-desc" name="description" placeholder="Optional description" />
                </div>
                <SubmitButton pendingLabel="Adding..." data-tour="add-kpi-btn">Add KPI</SubmitButton>
              </form>
            )}
          </section>
        )
      })()}

      {/* Add KRA manually */}
      {cycleId && (
        <form action={addKra as unknown as (fd: FormData) => Promise<void>} className="glass rounded-xl p-5 space-y-4">
          <h2 className="text-lg font-semibold">Add Key Result Area</h2>
          <input type="hidden" name="cycle_id" value={cycleId} />
          <input type="hidden" name="employee_id" value={employeeId} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="kra-title">Title</Label>
              <Input id="kra-title" name="title" required placeholder="e.g. Product Delivery" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="kra-weight">Weight (%)</Label>
              <Input id="kra-weight" name="weight" type="number" min="1" max="100" placeholder="e.g. 30" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="kra-category">Category</Label>
              <select
                id="kra-category"
                name="category"
                defaultValue="performance"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              >
                <option value="performance">Performance</option>
                <option value="behaviour">Behaviour</option>
                <option value="learning">Learning</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="kra-description">Description</Label>
              <Input id="kra-description" name="description" placeholder="Optional" />
            </div>
          </div>
          <SubmitButton pendingLabel="Adding...">Add KRA</SubmitButton>
        </form>
      )}
    </div>
  )
}
