import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import Link from 'next/link'
import { SyncButton } from './sync-button'

function ragBadge(achievement: number, red: number, amber: number) {
  if (achievement >= amber) return <span className="inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">Green</span>
  if (achievement >= red) return <span className="inline-block rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">Amber</span>
  return <span className="inline-block rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">Red</span>
}

export default async function AdminMisPage(props: {
  searchParams: Promise<{ category?: string; level?: string }>
}) {
  await requireRole(['admin'])
  const searchParams = await props.searchParams
  const filterCategory = searchParams.category
  const filterLevel = searchParams.level

  const [config, totalTargets, lastSync, unmappedCount, syncLogs, allTargets, categories, levels] = await Promise.all([
    prisma.misConfig.findFirst(),
    prisma.aopTarget.count(),
    prisma.misSyncLog.findFirst({ orderBy: { started_at: 'desc' } }),
    prisma.aopTarget.count({
      where: {
        kpi_mappings: { none: {} },
        level: 'individual',
      },
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
      },
      orderBy: { metric_name: 'asc' },
    }),
    prisma.aopTarget.groupBy({ by: ['category'], _count: true }),
    prisma.aopTarget.groupBy({ by: ['level'], _count: true }),
  ])

  const fiscalYear = config?.fiscal_year ?? new Date().getFullYear()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">MIS Integration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage AOP targets, sync data from MIS, and monitor integration health
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
              {lastSync.status} — {lastSync.records_synced} synced, {lastSync.records_failed} failed
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

      {/* Sync History */}
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
              {syncLogs.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No sync history</td></tr>
              ) : (
                syncLogs.map(log => {
                  const duration = log.completed_at && log.started_at
                    ? Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                    : null
                  return (
                    <tr key={log.id} className="border-b border-border">
                      <td className="p-3 capitalize">{log.sync_type}</td>
                      <td className="p-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          log.status === 'success' ? 'bg-emerald-500/20 text-emerald-400'
                          : log.status === 'failed' ? 'bg-red-500/20 text-red-400'
                          : log.status === 'running' ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {log.status}
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Target Overview */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Target Overview</h2>

        {/* Filters */}
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
                  className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${filterCategory === c.category ? 'bg-primary/20 text-primary' : 'glass-interactive'}`}
                >
                  {c.category} ({c._count})
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
                  className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${filterLevel === l.level ? 'bg-primary/20 text-primary' : 'glass-interactive'}`}
                >
                  {l.level} ({l._count})
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="glass overflow-hidden rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="p-3 text-left text-muted-foreground">Metric</th>
                <th className="p-3 text-left text-muted-foreground">Category</th>
                <th className="p-3 text-left text-muted-foreground">Level</th>
                <th className="p-3 text-left text-muted-foreground">Department / Employee</th>
                <th className="p-3 text-right text-muted-foreground">Annual Target</th>
                <th className="p-3 text-right text-muted-foreground">YTD Actual</th>
                <th className="p-3 text-right text-muted-foreground">Achievement</th>
                <th className="p-3 text-center text-muted-foreground">RAG</th>
              </tr>
            </thead>
            <tbody>
              {allTargets.length === 0 ? (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No targets found</td></tr>
              ) : (
                allTargets.map(t => {
                  const annual = Number(t.annual_target)
                  const ytd = Number(t.ytd_actual ?? 0)
                  const achievement = annual > 0 ? (ytd / annual) * 100 : 0
                  return (
                    <tr key={t.id} className="border-b border-border">
                      <td className="p-3 font-medium">{t.metric_name}</td>
                      <td className="p-3 text-muted-foreground capitalize">{t.category}</td>
                      <td className="p-3 text-muted-foreground capitalize">{t.level}</td>
                      <td className="p-3 text-muted-foreground">
                        {t.employee?.full_name ?? t.department?.name ?? '—'}
                      </td>
                      <td className="p-3 text-right">
                        {annual.toLocaleString('en-IN')} {t.unit}
                      </td>
                      <td className="p-3 text-right">{ytd.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right">{achievement.toFixed(1)}%</td>
                      <td className="p-3 text-center">
                        {ragBadge(achievement, Number(t.red_threshold), Number(t.amber_threshold))}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
