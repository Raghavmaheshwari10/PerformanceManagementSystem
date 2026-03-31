import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { CycleStatusBadge } from '@/components/cycle-status-badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { CYCLE_STATUS_LABELS } from '@/lib/constants'
import { AdminMetricCard } from './admin-metric-card'
import { AnimatedDonut } from './animated-donut'

function daysUntil(d: Date | string | null) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

const ROLE_COLORS: Record<string, string> = {
  employee: 'oklch(0.7 0.17 160)',   // emerald
  manager:  'oklch(0.7 0.17 85)',    // amber
  hrbp:     'oklch(0.65 0.22 310)',  // purple
  admin:    'oklch(0.65 0.22 265)',  // indigo
}

export default async function AdminDashboard() {
  await requireRole(['admin'])

  const [allCycles, activeUsers, lastImportLog] = await Promise.all([
    prisma.cycle.findMany({ orderBy: { created_at: 'desc' } }),
    prisma.user.findMany({
      where: { is_active: true },
      select: { id: true, role: true, department: { select: { name: true } }, is_active: true },
    }),
    prisma.auditLog.findFirst({
      where: { action: 'csv_upload' },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    }),
  ])

  const lastImport = lastImportLog?.created_at ?? null
  const activeCycle = allCycles.find(c => !['draft', 'published'].includes(c.status))

  let selfReviewsDone = 0, managerReviewsDone = 0, totalEmployees = 0, overdueManagerReviews = 0

  if (activeCycle) {
    const [reviews, appraisals] = await Promise.all([
      prisma.review.findMany({
        where: { cycle_id: activeCycle.id },
        select: { status: true },
      }),
      prisma.appraisal.findMany({
        where: { cycle_id: activeCycle.id },
        select: { manager_submitted_at: true },
      }),
    ])
    totalEmployees = activeUsers.filter(u => u.role === 'employee').length
    selfReviewsDone = reviews.filter(r => r.status === 'submitted').length
    managerReviewsDone = appraisals.filter(a => a.manager_submitted_at).length
    const days = daysUntil(activeCycle.manager_review_deadline)
    overdueManagerReviews = days !== null && days < 0 ? totalEmployees - managerReviewsDone : 0
  }

  const roleCounts = { employee: 0, manager: 0, hrbp: 0, admin: 0 }
  for (const u of activeUsers) roleCounts[u.role as keyof typeof roleCounts]++
  const totalUsers = activeUsers.length
  const deptCount = new Set(activeUsers.map(u => u.department?.name).filter(Boolean)).size

  const selfPct = totalEmployees > 0 ? (selfReviewsDone / totalEmployees) * 100 : 0
  const mgrPct = totalEmployees > 0 ? (managerReviewsDone / totalEmployees) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/admin/cycles" className="text-primary hover:text-primary/80 transition-colors">All cycles &rarr;</Link>
          <Link href="/admin/users" className="text-primary hover:text-primary/80 transition-colors">Manage users &rarr;</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cycle Health — spans 2 cols */}
        <div className={cn(
          'lg:col-span-2 glass p-6 space-y-4',
          overdueManagerReviews > 0 ? 'glass-glow-strong border-destructive/40' : 'glass-glow'
        )}>
          <h2 className="font-semibold">Cycle Health</h2>

          {activeCycle ? (
            <>
              <div className="flex items-center gap-3">
                <span className="font-medium text-sm">{activeCycle.name}</span>
                <CycleStatusBadge status={activeCycle.status} />
              </div>
              {overdueManagerReviews > 0 && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive font-medium">
                  ⚠ {overdueManagerReviews} manager review{overdueManagerReviews !== 1 ? 's' : ''} overdue
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Status: {CYCLE_STATUS_LABELS[activeCycle.status]}</span>
                {lastImport && <span>Last import {new Date(lastImport).toLocaleDateString()}</span>}
              </div>
              <Link href={`/admin/cycles/${activeCycle.id}`}>
                <Button variant="outline" size="sm" className="w-full glass-interactive">View Cycle Detail &rarr;</Button>
              </Link>
            </>
          ) : (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">No active cycle</p>
              <Link href="/admin/cycles/new">
                <Button size="sm" className="glow-button">Create Cycle &rarr;</Button>
              </Link>
            </div>
          )}
        </div>

        {/* Active Users counter */}
        <AdminMetricCard value={totalUsers} label="Active Users" />

        {/* Departments counter */}
        <AdminMetricCard value={deptCount} label="Departments" />

        {/* Self Reviews donut */}
        <div className="glass p-5 flex items-center justify-center">
          <AnimatedDonut
            percent={selfPct}
            color="oklch(0.65 0.22 265)"
            label="Self Reviews"
            sub={`${selfReviewsDone}/${totalEmployees}`}
          />
        </div>

        {/* Manager Reviews donut */}
        <div className="glass p-5 flex items-center justify-center">
          <AnimatedDonut
            percent={mgrPct}
            color="oklch(0.7 0.2 170)"
            label="Manager Reviews"
            sub={`${managerReviewsDone}/${totalEmployees}`}
          />
        </div>

        {/* Role Breakdown — spans 2 cols */}
        <div className="lg:col-span-2 glass p-5 space-y-3">
          <h2 className="font-semibold text-sm">Role Breakdown</h2>
          {(['employee', 'manager', 'hrbp', 'admin'] as const).map(r => (
            <div key={r} className="flex items-center gap-3 text-xs">
              <span className="w-16 text-right text-muted-foreground capitalize">{r}</span>
              <div className="flex-1 h-3 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${totalUsers > 0 ? (roleCounts[r] / totalUsers * 100) : 0}%`,
                    background: ROLE_COLORS[r],
                    animation: 'barGrow 1s cubic-bezier(0.16, 1, 0.3, 1) both',
                  }}
                />
              </div>
              <span className="w-6 font-medium">{roleCounts[r]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
