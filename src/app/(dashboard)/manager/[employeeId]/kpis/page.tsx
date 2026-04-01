import { prisma } from '@/lib/prisma'
import { requireRole, requireManagerOwnership } from '@/lib/auth'
import { addKpi, deleteKpi, addKra, deleteKra, finalizeKpis, unfinalizeKpis, areKpisFinalized } from '../../actions'
import { SubmitButton } from '@/components/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { KpiTemplatePicker } from '@/components/kpi-template-picker'
import { KraTemplatePicker } from '@/components/kra-template-picker'

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
      ? prisma.kpi.findMany({ where: { cycle_id: cycleId, employee_id: employeeId }, include: { kra: true } })
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
  }))
  const kras = rawKras.map(k => ({
    ...k,
    weight: k.weight ? Number(k.weight) : null,
  }))

  // Group KPIs by kra_id
  const kpisByKra = new Map<string | null, typeof kpis>()
  for (const kpi of kpis) {
    const key = kpi.kra_id
    const list = kpisByKra.get(key) || []
    list.push(kpi)
    kpisByKra.set(key, list)
  }

  // Check if KPIs are finalized (locked)
  const isFinalized = cycleId ? await areKpisFinalized(cycleId, employeeId) : false

  // Computed weight totals
  const totalKraWeight = kras.reduce((sum, k) => sum + (k.weight ?? 0), 0)
  const totalKpiWeight = kpis.reduce((sum, k) => sum + (k.weight ?? 0), 0)
  const ungroupedKpis = kpisByKra.get(null) || []

  // Reusable KRA form fields
  const kraFormFields = (
    <>
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
    </>
  )

  return (
    <div className="max-w-3xl space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">KPIs for {employee?.full_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define Key Result Areas first, then add KPIs under each one.
          </p>
        </div>
        {cycleId && !isFinalized && (
          <div className="flex items-center gap-2" data-tour="template-picker">
            <KraTemplatePicker cycleId={cycleId} employeeId={employeeId} />
            <KpiTemplatePicker cycleId={cycleId} employeeId={employeeId} />
          </div>
        )}
      </div>

      {pageError && (
        <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{pageError}</p>
      )}

      {/* Finalized banner */}
      {isFinalized && (
        <div className="glass-strong rounded-xl p-4 flex items-center justify-between border border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="size-5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-emerald-400">KPIs Finalized</p>
              <p className="text-xs text-muted-foreground">KRAs and KPIs are locked. Unlock to make changes.</p>
            </div>
          </div>
          <form action={unfinalizeKpis as unknown as (fd: FormData) => Promise<void>}>
            <input type="hidden" name="cycle_id" value={cycleId!} />
            <input type="hidden" name="employee_id" value={employeeId} />
            <SubmitButton variant="outline" size="sm" pendingLabel="Unlocking...">Unlock</SubmitButton>
          </form>
        </div>
      )}

      {/* ── Step Indicator ── */}
      {cycleId && (
        <div className="flex items-center gap-3 px-1">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
            <div>
              <span className="text-sm font-medium">Define KRAs</span>
              <p className="text-[11px] text-muted-foreground leading-tight">Broad outcome areas with weights</p>
            </div>
          </div>
          <div className="h-px flex-1 bg-border" />
          <div className="flex items-center gap-2">
            <span className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${kras.length > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'}`}>2</span>
            <div>
              <span className={`text-sm font-medium ${kras.length > 0 ? '' : 'text-muted-foreground'}`}>Add KPIs</span>
              <p className="text-[11px] text-muted-foreground leading-tight">Specific measurable targets</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Add KRA Section (promoted to top) ── */}
      {cycleId && !isFinalized && kras.length === 0 && (
        <>
          <div className="glass-strong glass-glow rounded-xl p-6 text-center space-y-3">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/15">
              <svg xmlns="http://www.w3.org/2000/svg" className="size-6 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold">Start by defining Key Result Areas</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              A KRA represents a broad outcome area (e.g., Product Delivery, Team Leadership).
              Weights across all KRAs should total 100%. After creating KRAs, you&apos;ll add specific KPIs under each one.
            </p>
          </div>

          <form action={addKra as unknown as (fd: FormData) => Promise<void>} className="glass-strong glass-glow rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-semibold">Create your first KRA</h2>
            <input type="hidden" name="cycle_id" value={cycleId} />
            <input type="hidden" name="employee_id" value={employeeId} />
            {kraFormFields}
            <SubmitButton pendingLabel="Creating...">Create KRA</SubmitButton>
          </form>
        </>
      )}

      {/* Collapsible "Add another KRA" when KRAs already exist */}
      {cycleId && !isFinalized && kras.length > 0 && (
        <details className="glass rounded-xl group">
          <summary className="cursor-pointer p-4 flex items-center gap-2 text-sm font-semibold hover:bg-muted/40 rounded-xl list-none [&::-webkit-details-marker]:hidden">
            <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-primary transition-transform group-open:rotate-45" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add another KRA
            {totalKraWeight < 100 && (
              <span className="ml-auto text-xs font-normal text-amber-400">{100 - totalKraWeight}% weight remaining</span>
            )}
          </summary>
          <form action={addKra as unknown as (fd: FormData) => Promise<void>} className="px-5 pb-5 space-y-4 border-t border-border pt-4">
            <input type="hidden" name="cycle_id" value={cycleId} />
            <input type="hidden" name="employee_id" value={employeeId} />
            {kraFormFields}
            <SubmitButton pendingLabel="Adding...">Add KRA</SubmitButton>
          </form>
        </details>
      )}

      {/* ── KRA Cards with nested KPIs ── */}
      {kras.map((kra, index) => {
        const kraKpis = kpisByKra.get(kra.id) || []
        const kraKpiWeight = kraKpis.reduce((sum, k) => sum + (k.weight ?? 0), 0)
        const remaining = 100 - kraKpiWeight
        const isFull = remaining <= 0
        const catStyle = CATEGORY_STYLES[kra.category] || CATEGORY_STYLES.performance

        return (
          <section key={kra.id} className="glass-strong rounded-xl overflow-hidden">

            {/* KRA Header */}
            <div className="flex items-center justify-between gap-3 p-5 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex size-6 items-center justify-center rounded-full bg-muted/50 text-xs font-bold text-muted-foreground">
                  {index + 1}
                </span>
                <h2 className="text-lg font-semibold">{kra.title}</h2>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${catStyle}`}>
                  {kra.category}
                </span>
                {kra.weight != null && (
                  <span className="rounded-full bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {String(kra.weight)}% weight
                  </span>
                )}
              </div>
              {!isFinalized && (
                <form action={deleteKra.bind(null, kra.id, employeeId) as unknown as (fd: FormData) => Promise<void>}>
                  <Button variant="ghost" size="sm" type="submit" className="text-destructive hover:text-destructive">
                    Remove
                  </Button>
                </form>
              )}
            </div>

            {kra.description && (
              <p className="text-sm text-muted-foreground px-5 pb-2">{kra.description}</p>
            )}

            {/* KPI weight progress bar */}
            <div className="px-5 pb-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>KPI weight allocated</span>
                <span className={isFull ? 'text-emerald-400 font-medium' : remaining < 30 ? 'text-amber-400' : ''}>
                  {kraKpiWeight}% / 100%{!isFull && ` \u2022 ${remaining}% remaining`}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isFull ? 'bg-emerald-500/70' : 'bg-primary/60'}`}
                  style={{ width: `${Math.min(100, kraKpiWeight)}%` }}
                />
              </div>
            </div>

            {/* KPI list */}
            <div className="px-5 space-y-2">
              {kraKpis.length === 0 && (
                <p className="text-sm text-muted-foreground italic py-2">
                  No KPIs yet — add your first KPI below to define measurable targets for this area.
                </p>
              )}
              {kraKpis.map(kpi => (
                <div key={kpi.id} className="glass-interactive flex items-center justify-between rounded-lg p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{kpi.title}</p>
                    {kpi.target != null && (
                      <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                        Target: {kpi.unit === 'percent' ? `${Number(kpi.target)}%` : String(Number(kpi.target))}
                      </span>
                    )}
                    {kpi.weight != null && (
                      <span className="rounded-full bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                        {String(kpi.weight)}%
                      </span>
                    )}
                  </div>
                  {!isFinalized && (
                    <form action={deleteKpi.bind(null, kpi.id, employeeId) as unknown as (fd: FormData) => Promise<void>}>
                      <Button variant="ghost" size="sm" type="submit">Remove</Button>
                    </form>
                  )}
                </div>
              ))}
            </div>

            {/* Add KPI form — hidden when finalized or weight is fully allocated */}
            {cycleId && !isFinalized && (
              <div className="border-t border-border mt-3 p-5">
                {isFull ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    100% weight allocated — remove a KPI to add more.
                  </div>
                ) : (
                  <form action={addKpi as unknown as (fd: FormData) => Promise<void>} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add KPI
                      </h3>
                      <span className="text-xs text-muted-foreground">{remaining}% weight available</span>
                    </div>
                    <input type="hidden" name="cycle_id" value={cycleId} />
                    <input type="hidden" name="employee_id" value={employeeId} />
                    <input type="hidden" name="kra_id" value={kra.id} />
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor={`kpi-title-${kra.id}`}>Title</Label>
                        <Input id={`kpi-title-${kra.id}`} name="title" required placeholder="e.g. Deliver feature X by Q2" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`kpi-target-${kra.id}`}>Target</Label>
                        <Input id={`kpi-target-${kra.id}`} name="target" type="number" step="any" placeholder="e.g. 95" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`kpi-weight-${kra.id}`}>Weight (%)</Label>
                        <Input id={`kpi-weight-${kra.id}`} name="weight" type="number" min="1" max={remaining} required placeholder={`Max ${remaining}`} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`kpi-desc-${kra.id}`}>Description</Label>
                      <Input id={`kpi-desc-${kra.id}`} name="description" placeholder="How will this be measured? (optional)" />
                    </div>
                    <SubmitButton pendingLabel="Adding...">Add KPI</SubmitButton>
                  </form>
                )}
              </div>
            )}

          </section>
        )
      })}

      {/* ── Orphaned KPIs (only if they exist) ── */}
      {ungroupedKpis.length > 0 && (
        <section className="glass rounded-xl p-5 space-y-3 opacity-75">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-muted-foreground">Unassigned KPIs</h2>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
              {ungroupedKpis.length} orphaned
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            These KPIs aren&apos;t assigned to any KRA. They may have been detached when a KRA was removed. Consider creating a new KRA for them.
          </p>
          <div className="space-y-2">
            {ungroupedKpis.map(kpi => (
              <div key={kpi.id} className="glass-interactive flex items-center justify-between rounded-lg p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{kpi.title}</p>
                  {kpi.target != null && (
                    <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                      Target: {kpi.unit === 'percent' ? `${Number(kpi.target)}%` : String(Number(kpi.target))}
                    </span>
                  )}
                  {kpi.weight != null && (
                    <span className="rounded-full bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                      {String(kpi.weight)}%
                    </span>
                  )}
                </div>
                {!isFinalized && (
                  <form action={deleteKpi.bind(null, kpi.id, employeeId) as unknown as (fd: FormData) => Promise<void>}>
                    <Button variant="ghost" size="sm" type="submit">Remove</Button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Weight Summary Footer + Finalize Button ── */}
      {kras.length > 0 && (
        <div className="glass rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <span>KRA weight: <strong>{totalKraWeight}%</strong> / 100%</span>
            <span className="text-muted-foreground">|</span>
            <span>Total KPI weight: <strong>{totalKpiWeight}%</strong></span>
          </div>
          {totalKraWeight !== 100 && (
            <span className="text-amber-400 text-xs">
              KRA weights should sum to 100% ({totalKraWeight < 100 ? `${100 - totalKraWeight}% remaining` : `${totalKraWeight - 100}% over`})
            </span>
          )}
          {totalKraWeight === 100 && (
            <span className="text-emerald-400 text-xs flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Fully allocated
            </span>
          )}
        </div>
      )}

      {/* ── Finalize Button ── */}
      {cycleId && kras.length > 0 && !isFinalized && (
        <form action={finalizeKpis as unknown as (fd: FormData) => Promise<void>}>
          <input type="hidden" name="cycle_id" value={cycleId} />
          <input type="hidden" name="employee_id" value={employeeId} />
          <SubmitButton className="w-full glow-button" pendingLabel="Finalizing...">
            Finalize KRAs &amp; KPIs
          </SubmitButton>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Locking will prevent further edits. You can unlock later if needed.
          </p>
        </form>
      )}

      {/* ── Helper Guide (shown when no data yet) ── */}
      {cycleId && kras.length === 0 && ungroupedKpis.length === 0 && (
        <div className="glass rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">Quick Guide</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
            <div className="space-y-1">
              <p className="font-medium text-foreground">What is a KRA?</p>
              <p>A Key Result Area defines a broad performance category like &quot;Revenue Growth&quot; or &quot;Product Quality&quot;.</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">What is a KPI?</p>
              <p>A Key Performance Indicator is a specific, measurable target under a KRA like &quot;Close 15 deals this quarter&quot;.</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground">How do weights work?</p>
              <p>KRA weights should total 100%. KPI weights within each KRA should also total 100%. This ensures fair evaluation.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
