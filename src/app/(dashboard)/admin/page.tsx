import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { requireRole, getCurrentUser } from '@/lib/auth'
import { CycleStatusBadge } from '@/components/cycle-status-badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { CYCLE_STATUS_LABELS } from '@/lib/constants'
import { StatCardsSkeleton } from '@/components/skeletons'
import { OnboardingChecklist } from '@/components/onboarding-checklist'
import type { ChecklistItem } from '@/components/onboarding-checklist'
import { markUserOnboarded } from '@/lib/tour-actions'

function daysUntil(d: Date | string | null) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

const ROLE_META: Record<string, { color: string; bg: string; label: string }> = {
  employee: { color: '#10b981', bg: 'bg-emerald-50', label: 'Employees' },
  manager:  { color: '#f59e0b', bg: 'bg-amber-50',   label: 'Managers' },
  hrbp:     { color: '#a855f7', bg: 'bg-violet-50',   label: 'HRBPs' },
  admin:    { color: '#4f46e5', bg: 'bg-indigo-50',   label: 'Admins' },
}

export default async function AdminDashboard() {
  await requireRole(['admin'])

  return (
    <div className="space-y-6">
      {/* Header stays in shell — renders instantly */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Overview of your performance management system</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/cycles/new">
            <Button size="sm" className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30">
              + New Cycle
            </Button>
          </Link>
        </div>
      </div>

      <Suspense fallback={<StatCardsSkeleton />}>
        <AdminDashboardContent />
      </Suspense>
    </div>
  )
}

async function AdminDashboardContent() {
  const [allCycles, activeUsers, totalUsersAll, lastImportLog, recentNotifs, departments] = await Promise.all([
    prisma.cycle.findMany({ orderBy: { created_at: 'desc' }, take: 5 }),
    prisma.user.findMany({
      where: { is_active: true },
      select: { id: true, role: true, department: { select: { name: true } } },
    }),
    prisma.user.count(),
    prisma.auditLog.findFirst({
      where: { action: 'csv_upload' },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    }),
    prisma.notification.count({ where: { status: 'pending' } }),
    prisma.department.count(),
  ])

  const user = await getCurrentUser()
  const showOnboarding = !user.onboarded_at

  const kpiTemplateCount = showOnboarding ? await prisma.kpiTemplate.count() : 0

  const checklistItems: ChecklistItem[] = showOnboarding ? [
    { label: 'Add departments', completed: departments > 0, href: '/admin/departments' },
    { label: 'Add users', completed: activeUsers.length >= 2, href: '/admin/users' },
    { label: 'Create first cycle', completed: allCycles.length > 0, href: '/admin/cycles/new' },
    { label: 'Configure KPI templates', completed: kpiTemplateCount > 0, href: '/admin/kpi-templates' },
  ] : []

  const inactiveUsers = totalUsersAll - activeUsers.length
  const activeCycle = allCycles.find(c => !['draft', 'published'].includes(c.status))

  let selfReviewsDone = 0, managerReviewsDone = 0, totalEmployees = 0, overdueManagerReviews = 0, kpiCount = 0

  if (activeCycle) {
    const [reviews, appraisals, kpis] = await Promise.all([
      prisma.review.findMany({ where: { cycle_id: activeCycle.id }, select: { status: true } }),
      prisma.appraisal.findMany({ where: { cycle_id: activeCycle.id }, select: { manager_submitted_at: true } }),
      prisma.kpi.count({ where: { cycle_id: activeCycle.id } }),
    ])
    totalEmployees = activeUsers.filter(u => u.role === 'employee').length
    selfReviewsDone = reviews.filter(r => r.status === 'submitted').length
    managerReviewsDone = appraisals.filter(a => a.manager_submitted_at).length
    kpiCount = kpis
    const days = daysUntil(activeCycle.manager_review_deadline)
    overdueManagerReviews = days !== null && days < 0 ? totalEmployees - managerReviewsDone : 0
  }

  const roleCounts = { employee: 0, manager: 0, hrbp: 0, admin: 0 }
  for (const u of activeUsers) roleCounts[u.role as keyof typeof roleCounts]++

  const selfPct = totalEmployees > 0 ? Math.round((selfReviewsDone / totalEmployees) * 100) : 0
  const mgrPct = totalEmployees > 0 ? Math.round((managerReviewsDone / totalEmployees) * 100) : 0

  return (
    <>
      {showOnboarding && <OnboardingChecklist items={checklistItems} dismissAction={markUserOnboarded} />}

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Active Users"
          value={activeUsers.length}
          sub={inactiveUsers > 0 ? `${inactiveUsers} inactive` : 'All active'}
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>}
          iconColor="text-indigo-600 bg-indigo-50"
          href="/admin/users"
        />
        <StatCard
          label="Departments"
          value={departments}
          sub={`${activeUsers.length} users assigned`}
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 7.5h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" /></svg>}
          iconColor="text-violet-600 bg-violet-50"
          href="/admin/departments"
        />
        <StatCard
          label="Total Cycles"
          value={allCycles.length}
          sub={activeCycle ? `${activeCycle.name} active` : 'None active'}
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg>}
          iconColor="text-emerald-600 bg-emerald-50"
          href="/admin/cycles"
        />
        <StatCard
          label="Pending Notifications"
          value={recentNotifs}
          sub="Awaiting dispatch"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>}
          iconColor="text-amber-600 bg-amber-50"
          href="/admin/notifications"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Cycle Health — 2 cols */}
        <div className={cn(
          'lg:col-span-2 glass p-6 space-y-4',
          overdueManagerReviews > 0 && 'border-red-200'
        )}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Cycle Health</h2>
            <Link href="/admin/cycles" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">View all &rarr;</Link>
          </div>

          {activeCycle ? (
            <>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-800">{activeCycle.name}</span>
                <CycleStatusBadge status={activeCycle.status} />
              </div>

              {overdueManagerReviews > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-medium flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                  {overdueManagerReviews} manager review{overdueManagerReviews !== 1 ? 's' : ''} overdue
                </div>
              )}

              {/* Progress bars */}
              <div className="grid grid-cols-2 gap-6">
                <ProgressBlock label="Self Reviews" done={selfReviewsDone} total={totalEmployees} pct={selfPct} color="bg-indigo-600" />
                <ProgressBlock label="Manager Reviews" done={managerReviewsDone} total={totalEmployees} pct={mgrPct} color="bg-emerald-600" />
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                <span>Status: {CYCLE_STATUS_LABELS[activeCycle.status]}</span>
                <span>{kpiCount} KPIs set</span>
                {activeCycle.manager_review_deadline && (
                  <span>Deadline: {new Date(activeCycle.manager_review_deadline).toLocaleDateString()}</span>
                )}
              </div>

              <Link href={`/admin/cycles/${activeCycle.id}`}>
                <Button variant="outline" size="sm" className="w-full mt-1 border-slate-200 hover:bg-slate-50">
                  View Cycle Detail &rarr;
                </Button>
              </Link>
            </>
          ) : (
            <div className="py-10 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
                <svg className="h-7 w-7 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg>
              </div>
              <p className="text-sm text-slate-500">No active cycle running</p>
              <Link href="/admin/cycles/new">
                <Button size="sm" className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20">
                  Create Cycle &rarr;
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Role Breakdown */}
        <div className="glass p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Team Composition</h2>
            <Link href="/admin/users" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Manage &rarr;</Link>
          </div>

          <div className="space-y-3">
            {(['employee', 'manager', 'hrbp', 'admin'] as const).map(r => {
              const meta = ROLE_META[r]
              const pct = activeUsers.length > 0 ? Math.round((roleCounts[r] / activeUsers.length) * 100) : 0
              return (
                <div key={r} className="flex items-center gap-3">
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold', meta.bg)} style={{ color: meta.color }}>
                    {roleCounts[r]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-slate-700">{meta.label}</span>
                      <span className="text-slate-400">{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: meta.color,
                          animation: 'barGrow 1s cubic-bezier(0.16, 1, 0.3, 1) both',
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{activeUsers.length} active users</span>
              {inactiveUsers > 0 && <span className="text-amber-600">{inactiveUsers} inactive</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickAction
          href="/admin/users/new"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" /></svg>}
          label="Add User"
          color="text-indigo-600 bg-indigo-50 border-indigo-100"
        />
        <QuickAction
          href="/admin/cycles/new"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>}
          label="New Cycle"
          color="text-violet-600 bg-violet-50 border-violet-100"
        />
        <QuickAction
          href="/admin/notifications"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>}
          label="Send Notification"
          color="text-emerald-600 bg-emerald-50 border-emerald-100"
        />
        <QuickAction
          href="/admin/users/upload"
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>}
          label="Upload CSV"
          color="text-amber-600 bg-amber-50 border-amber-100"
        />
      </div>

      {/* Recent Cycles */}
      {allCycles.length > 0 && (
        <div className="glass overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent Cycles</h2>
            <Link href="/admin/cycles" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">View all &rarr;</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {allCycles.slice(0, 5).map(cycle => (
              <Link
                key={cycle.id}
                href={`/admin/cycles/${cycle.id}`}
                className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-800">{cycle.name}</span>
                  <CycleStatusBadge status={cycle.status} />
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>{cycle.quarter} {cycle.year}</span>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

/* ── Sub-components ── */

function StatCard({ label, value, sub, icon, iconColor, href }: {
  label: string; value: number; sub: string; icon: React.ReactNode; iconColor: string; href: string
}) {
  return (
    <Link href={href} className="group glass glass-interactive p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', iconColor)}>
          {icon}
        </div>
        <svg className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" /></svg>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      <p className="text-[11px] text-slate-400 mt-1">{sub}</p>
    </Link>
  )
}

function ProgressBlock({ label, done, total, pct, color }: {
  label: string; done: number; total: number; pct: number; color: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-700">{label}</span>
        <span className="text-xs font-bold text-slate-900">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full', color)}
          style={{ width: `${pct}%`, animation: 'barGrow 1s cubic-bezier(0.16, 1, 0.3, 1) both' }}
        />
      </div>
      <p className="text-[11px] text-slate-400">{done} of {total} completed</p>
    </div>
  )
}

function QuickAction({ href, icon, label, color }: {
  href: string; icon: React.ReactNode; label: string; color: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md',
        color
      )}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </Link>
  )
}
