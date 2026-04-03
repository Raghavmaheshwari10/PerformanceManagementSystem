import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { toTitleCase, MIS_SYNC_STATUS_LABELS } from '@/lib/constants'
import Link from 'next/link'
import { SyncButton } from './sync-button'
import { MisClient } from './mis-client'
import { CsvImport } from './csv-import'

export default async function AdminMisPage(props: {
  searchParams: Promise<{ category?: string; level?: string }>
}) {
  await requireRole(['admin'])
  const searchParams = await props.searchParams
  const filterCategory = searchParams.category
  const filterLevel = searchParams.level

  const [config, totalTargets, lastSync, unmappedCount, syncLogs, allTargetsRaw, categories, levels, departments, employees] = await Promise.all([
    prisma.misConfig.findFirst(),
    prisma.aopTarget.count(),
    prisma.misSyncLog.findFirst({ orderBy: { started_at: 'desc' } }),
    prisma.aopTarget.count({
      where: { kpi_mappings: { none: {} }, level: 'individual' },
    }),
    prisma.misSyncLog.findMany({ orderBy: { started_at: 'desc' }, take: 10 }),
    prisma.aopTarget.findMany({
      where: {
        ...(filterCategory ? { category: filterCategory } : {}),
        ...(filterLevel ? { level: filterLevel } : {}),
      },
      include: {
        department: { select: { name: true } },
        employee: { select: { full_name: true } },
        actuals: { select: { month: true, actual_value: true } },
      },
      orderBy: { metric_name: 'asc' },
    }),
    prisma.aopTarget.groupBy({ by: ['category'], _count: true }),
    prisma.aopTarget.groupBy({ by: ['level'], _count: true }),
    prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { is_active: true, role: { notIn: ['admin', 'hrbp'] } },
      orderBy: { full_name: 'asc' },
      select: { id: true, full_name: true, email: true, department_id: true },
    }),
  ])

  const fiscalYear = config?.fiscal_year ?? new Date().getFullYear()

  // Serialize targets for client component
  const targets = allTargetsRaw.map(t => ({
    id: t.id,
    metric_name: t.metric_name,
    category: t.category,
    level: t.level,
    annual_target: Number(t.annual_target),
    unit: t.unit,
    ytd_actual: Number(t.ytd_actual ?? 0),
    department_id: t.department_id,
    employee_id: t.employee_id,
    department_name: t.department?.name ?? null,
    employee_name: t.employee?.full_name ?? null,
    red_threshold: Number(t.red_threshold),
    amber_threshold: Number(t.amber_threshold),
    actuals: Object.fromEntries(t.actuals.map(a => [a.month, Number(a.actual_value)])),
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">MIS Integration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage AOP targets, enter actuals, and monitor integration health
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/mis/settings"
            className="glass-interactive rounded-lg px-4 py-2 text-sm font-medium"
          >
            Settings
          </Link>
          <SyncButton />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground">Last Sync</p>
          <p className="mt-1 text-lg font-semibold">
            {lastSync?.completed_at
              ? new Date(lastSync.completed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
              : 'Never'}
          </p>
          {lastSync && (
            <p className={`text-xs mt-0.5 ${lastSync.status === 'success' ? 'text-emerald-400' : lastSync.status === 'failed' ? 'text-red-400' : 'text-amber-400'}`}>
              {MIS_SYNC_STATUS_LABELS[lastSync.status] ?? lastSync.status} — {lastSync.records_synced} synced, {lastSync.records_failed} failed
            </p>
          )}
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Targets</p>
          <p className="mt-1 text-lg font-semibold">{totalTargets}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground">Fiscal Year</p>
          <p className="mt-1 text-lg font-semibold">FY {fiscalYear}</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-xs font-medium text-muted-foreground">Unmapped Individual Targets</p>
          <p className={`mt-1 text-lg font-semibold ${unmappedCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {unmappedCount}
          </p>
        </div>
      </div>

      {/* CSV Import */}
      <CsvImport fiscalYear={fiscalYear} />

      {/* Sync History */}
      {syncLogs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Sync History</h2>
          <div className="glass overflow-hidden rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="p-3 text-left text-muted-foreground">Type</th>
                  <th className="p-3 text-left text-muted-foreground">Status</th>
                  <th className="p-3 text-right text-muted-foreground">Synced</th>
                  <th className="p-3 text-right text-muted-foreground">Failed</th>
                  <th className="p-3 text-left text-muted-foreground">Started</th>
                  <th className="p-3 text-left text-muted-foreground">Duration</th>
                </tr>
              </thead>
              <tbody>
                {syncLogs.map(log => {
                  const duration = log.completed_at && log.started_at
                    ? Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                    : null
                  return (
                    <tr key={log.id} className="border-b border-border">
                      <td className="p-3">{toTitleCase(log.sync_type)}</td>
                      <td className="p-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          log.status === 'success' ? 'bg-emerald-500/20 text-emerald-400'
                          : log.status === 'failed' ? 'bg-red-500/20 text-red-400'
                          : log.status === 'running' ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {MIS_SYNC_STATUS_LABELS[log.status] ?? log.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">{log.records_synced}</td>
                      <td className="p-3 text-right">{log.records_failed}</td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(log.started_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="p-3 text-muted-foreground">{duration != null ? `${duration}s` : '...'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Targets</h2>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Category:</label>
            <div className="flex gap-1">
              <Link
                href="/admin/mis"
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${!filterCategory ? 'bg-primary/20 text-primary' : 'glass-interactive'}`}
              >
                All
              </Link>
              {categories.map(c => (
                <Link
                  key={c.category}
                  href={`/admin/mis?category=${c.category}${filterLevel ? `&level=${filterLevel}` : ''}`}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${filterCategory === c.category ? 'bg-primary/20 text-primary' : 'glass-interactive'}`}
                >
                  {toTitleCase(c.category)} ({c._count})
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Level:</label>
            <div className="flex gap-1">
              <Link
                href={`/admin/mis${filterCategory ? `?category=${filterCategory}` : ''}`}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${!filterLevel ? 'bg-primary/20 text-primary' : 'glass-interactive'}`}
              >
                All
              </Link>
              {levels.map(l => (
                <Link
                  key={l.level}
                  href={`/admin/mis?level=${l.level}${filterCategory ? `&category=${filterCategory}` : ''}`}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${filterLevel === l.level ? 'bg-primary/20 text-primary' : 'glass-interactive'}`}
                >
                  {toTitleCase(l.level)} ({l._count})
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive target list with CRUD + actuals entry */}
      <MisClient
        targets={targets}
        departments={departments}
        employees={employees}
        fiscalYear={fiscalYear}
      />
    </div>
  )
}
