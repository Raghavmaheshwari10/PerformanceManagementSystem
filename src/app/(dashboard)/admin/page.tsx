import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { CycleStatusBadge } from '@/components/cycle-status-badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { CYCLE_STATUS_LABELS } from '@/lib/constants'
import type { Cycle, User } from '@/lib/types'

function daysUntil(d: string | null) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

function ProgressRing({ pct, label, sub }: { pct: number; label: string; sub: string }) {
  const r = 28, circ = 2 * Math.PI * r, dash = circ * Math.min(pct / 100, 1)
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/40" />
        <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 36 36)"
          className={pct >= 100 ? 'text-green-500' : pct >= 50 ? 'text-primary' : 'text-amber-500'}
        />
        <text x="36" y="40" textAnchor="middle" fill="currentColor" fontSize="13" className="text-xs font-bold">
          {Math.round(pct)}%
        </text>
      </svg>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  )
}

export default async function AdminDashboard() {
  await requireRole(['admin'])
  const supabase = await createClient()

  const [cyclesRes, usersRes, auditRes] = await Promise.all([
    supabase.from('cycles').select('*').order('created_at', { ascending: false }),
    supabase.from('users').select('id, role, department, is_active').eq('is_active', true),
    supabase.from('audit_logs').select('created_at').eq('action', 'csv_upload').order('created_at', { ascending: false }).limit(1),
  ])

  const allCycles = (cyclesRes.data as Cycle[]) ?? []
  const activeUsers = (usersRes.data ?? []) as Pick<User, 'id' | 'role' | 'department' | 'is_active'>[]
  const lastImport = auditRes.data?.[0]?.created_at ?? null

  const activeCycle = allCycles.find(c => !['draft', 'published'].includes(c.status))

  let selfReviewsDone = 0, managerReviewsDone = 0, totalEmployees = 0, overdueManagerReviews = 0

  if (activeCycle) {
    const [reviewsRes, appraisalsRes] = await Promise.all([
      supabase.from('reviews').select('status').eq('cycle_id', activeCycle.id),
      supabase.from('appraisals').select('manager_submitted_at').eq('cycle_id', activeCycle.id),
    ])
    totalEmployees = activeUsers.filter(u => u.role === 'employee').length
    selfReviewsDone = (reviewsRes.data ?? []).filter(r => r.status === 'submitted').length
    managerReviewsDone = (appraisalsRes.data ?? []).filter(a => a.manager_submitted_at).length
    const days = daysUntil(activeCycle.manager_review_deadline)
    overdueManagerReviews = days !== null && days < 0 ? totalEmployees - managerReviewsDone : 0
  }

  const roleCounts = { employee: 0, manager: 0, hrbp: 0, admin: 0 }
  for (const u of activeUsers) roleCounts[u.role as keyof typeof roleCounts]++
  const deptCount = new Set(activeUsers.map(u => u.department?.name).filter(Boolean)).size

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cycle Health Panel */}
        <div className={cn('rounded-lg border p-5 space-y-4', overdueManagerReviews > 0 && 'border-destructive/40')}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Cycle Health</h2>
            <Link href="/admin/cycles" className="text-xs text-muted-foreground hover:underline">All cycles →</Link>
          </div>

          {activeCycle ? (
            <>
              <div className="flex items-center gap-3">
                <span className="font-medium text-sm">{activeCycle.name}</span>
                <CycleStatusBadge status={activeCycle.status} />
              </div>
              {overdueManagerReviews > 0 && (
                <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive font-medium">
                  ⚠ {overdueManagerReviews} manager review{overdueManagerReviews !== 1 ? 's' : ''} overdue
                </div>
              )}
              {totalEmployees > 0 && (
                <div className="flex gap-8 justify-center py-2">
                  <ProgressRing pct={(selfReviewsDone / totalEmployees) * 100} label="Self Reviews" sub={`${selfReviewsDone} / ${totalEmployees}`} />
                  <ProgressRing pct={(managerReviewsDone / totalEmployees) * 100} label="Manager Reviews" sub={`${managerReviewsDone} / ${totalEmployees}`} />
                  <ProgressRing
                    pct={activeCycle.status === 'published' ? 100 : ['locked','calibrating'].includes(activeCycle.status) ? (managerReviewsDone / totalEmployees) * 80 : (selfReviewsDone / totalEmployees) * 40}
                    label="Overall" sub={CYCLE_STATUS_LABELS[activeCycle.status]}
                  />
                </div>
              )}
              <Link href={`/admin/cycles/${activeCycle.id}`}>
                <Button variant="outline" size="sm" className="w-full">View Cycle Detail →</Button>
              </Link>
            </>
          ) : (
            <div className="py-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">No active cycle</p>
              <Link href="/admin/cycles/new"><Button size="sm">Create Cycle →</Button></Link>
            </div>
          )}
        </div>

        {/* People Panel */}
        <div className="rounded-lg border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">People</h2>
            <Link href="/admin/users" className="text-xs text-muted-foreground hover:underline">Manage users →</Link>
          </div>

          <div className="text-center">
            <p className="text-4xl font-bold">{activeUsers.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Active users</p>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            {(['employee','manager','hrbp','admin'] as const).map(r => (
              <div key={r} className="rounded-md bg-muted/40 p-2">
                <p className="text-lg font-semibold">{roleCounts[r]}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{r}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-between text-sm border-t pt-3">
            <span className="text-muted-foreground">{deptCount} department{deptCount !== 1 ? 's' : ''}</span>
            <span className="text-muted-foreground">
              {lastImport ? `Last import ${new Date(lastImport).toLocaleDateString()}` : 'No imports yet'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
