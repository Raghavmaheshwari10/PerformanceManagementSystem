# Admin Section Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul the admin section with a dashboard overview, cycle detail page, enhanced users page, KPI template management, and manual notifications.

**Architecture:** Restructure `/admin` into a dashboard; move cycle list to `/admin/cycles`; add five new routes. All new server actions follow the `ActionResult<T>` pattern. Client-side filtering on the users page avoids round-trips; cycle detail and dashboard are server components.

**Tech Stack:** Next.js 16 App Router, Supabase (service client for admin actions), Tailwind v4 + shadcn/ui, `useActionState` for forms, Vitest for unit tests.

---

## Task 1: DB Migration — Schema Additions

**Files:**
- Create: `supabase/migrations/00016_admin_overhaul.sql`

**Step 1: Write the migration**

```sql
-- Add is_active to kpi_templates (enables soft-delete in UI)
ALTER TABLE kpi_templates
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add new notification types for admin features
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'admin_message';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'review_reminder';
```

**Step 2: Apply locally**

```bash
npx supabase db reset
```
Expected: migration runs, no errors.

**Step 3: Apply to cloud via MCP**

Use `mcp__supabase__apply_migration` with project_id `cekmehtfghzhnzmxjbcx`, name `admin_overhaul`, and the SQL above.

**Step 4: Update `KpiTemplate` type in `src/lib/types.ts`**

Add `is_active: boolean` field to the `KpiTemplate` interface (after `sort_order`).

**Step 5: Update `NotificationType` in `src/lib/types.ts`**

```ts
export type NotificationType =
  | "cycle_kpi_setting_open"
  | "cycle_self_review_open"
  | "cycle_manager_review_open"
  | "cycle_published"
  | "review_submitted"
  | "manager_review_submitted"
  | "admin_message"
  | "review_reminder"
```

**Step 6: Commit**

```bash
git add supabase/migrations/00016_admin_overhaul.sql src/lib/types.ts
git commit -m "feat: add is_active to kpi_templates, admin_message + review_reminder notification types"
```

---

## Task 2: Route Restructure — Move Cycles, Update Sidebar

**Files:**
- Create: `src/app/(dashboard)/admin/cycles/page.tsx` (moved content)
- Modify: `src/app/(dashboard)/admin/page.tsx` (replace with dashboard)
- Modify: `src/components/sidebar.tsx`
- Modify: `src/app/(dashboard)/admin/cycles/new/page.tsx` (update back link)

**Step 1: Create `/admin/cycles/page.tsx`**

Copy the entire current content of `src/app/(dashboard)/admin/page.tsx` into the new file. In the cycles table, make cycle names into links:

```tsx
<td className="p-3">
  <Link href={`/admin/cycles/${cycle.id}`} className="hover:underline font-medium">
    {cycle.name}
  </Link>
</td>
```

Also update the "Create Cycle" button href to `/admin/cycles/new`.

**Step 2: Update sidebar nav**

In `src/components/sidebar.tsx`, change the admin nav items:

```ts
admin: [
  { label: 'Dashboard',     href: '/admin' },
  { label: 'Cycles',        href: '/admin/cycles' },
  { label: 'Users',         href: '/admin/users' },
  { label: 'KPI Templates', href: '/admin/kpi-templates' },
  { label: 'Notifications', href: '/admin/notifications' },
  { label: 'Feature Flags', href: '/admin/feature-flags' },
  { label: 'Audit Log',     href: '/admin/audit-log' },
],
```

**Step 3: Update active-state matching in sidebar**

The current sidebar uses `pathname === item.href` for exact match. Change to `pathname.startsWith(item.href)` for nested routes — but keep Dashboard exact to avoid it always being active:

```ts
pathname === item.href ||
(item.href !== '/admin' && pathname.startsWith(item.href))
```

**Step 4: Update new cycle page back link**

In `src/app/(dashboard)/admin/cycles/new/page.tsx`, if there's a back link pointing to `/admin`, update it to `/admin/cycles`.

**Step 5: Verify in browser**

Run `npm run dev`, navigate to `/admin/cycles` — should show current cycle table. Sidebar should show all 7 items.

**Step 6: Commit**

```bash
git add src/app/(dashboard)/admin/cycles/page.tsx src/components/sidebar.tsx
git commit -m "feat: move cycle list to /admin/cycles, update sidebar nav"
```

---

## Task 3: Admin Dashboard (`/admin`)

**Files:**
- Modify: `src/app/(dashboard)/admin/page.tsx`

**Step 1: Write the new dashboard page**

Replace `src/app/(dashboard)/admin/page.tsx` entirely:

```tsx
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
  const activeUsers = (usersRes.data as Pick<User, 'id' | 'role' | 'department' | 'is_active'>[]) ?? []
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
  const deptCount = new Set(activeUsers.map(u => u.department).filter(Boolean)).size

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
```

**Step 2: Run dev server, navigate to `/admin`**

Verify both panels render. If no active cycle, confirm the fallback CTA shows.

**Step 3: Commit**

```bash
git add src/app/(dashboard)/admin/page.tsx
git commit -m "feat: admin dashboard with cycle health + people panels"
```

---

## Task 4: Cycle Detail Page (`/admin/cycles/[id]`)

**Files:**
- Create: `src/app/(dashboard)/admin/cycles/[id]/page.tsx`
- Create: `src/app/(dashboard)/admin/cycles/[id]/actions.ts`

**Step 1: Write server actions**

`src/app/(dashboard)/admin/cycles/[id]/actions.ts`:

```ts
'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function sendSelfReviewReminders(cycleId: string): Promise<ActionResult<{ sent: number }>> {
  const user = await requireRole(['admin'])
  const supabase = await createServiceClient()

  // Find employees with no submitted self-review in this cycle
  const { data: allActive } = await supabase
    .from('users').select('id').eq('is_active', true).eq('role', 'employee')
  const { data: submitted } = await supabase
    .from('reviews').select('employee_id').eq('cycle_id', cycleId).eq('status', 'submitted')

  const submittedIds = new Set((submitted ?? []).map(r => r.employee_id))
  const pending = (allActive ?? []).filter(u => !submittedIds.has(u.id))

  if (pending.length === 0) return { data: { sent: 0 }, error: null }

  const notifications = pending.map(u => ({
    user_id: u.id,
    type: 'review_reminder' as const,
    payload: { cycle_id: cycleId, kind: 'self_review' },
  }))

  const { error } = await supabase.from('notifications').insert(notifications)
  if (error) return { data: null, error: error.message }

  await supabase.from('audit_logs').insert({
    changed_by: user.id,
    action: 'send_reminders',
    entity_type: 'cycle',
    entity_id: cycleId,
    new_value: { kind: 'self_review', count: pending.length },
  })

  revalidatePath(`/admin/cycles/${cycleId}`)
  return { data: { sent: pending.length }, error: null }
}

export async function sendManagerReviewReminders(cycleId: string): Promise<ActionResult<{ sent: number }>> {
  const user = await requireRole(['admin'])
  const supabase = await createServiceClient()

  const { data: appraisals } = await supabase
    .from('appraisals').select('employee_id, manager_id, manager_submitted_at').eq('cycle_id', cycleId)

  const pendingManagerIds = [...new Set(
    (appraisals ?? []).filter(a => !a.manager_submitted_at).map(a => a.manager_id)
  )]

  if (pendingManagerIds.length === 0) return { data: { sent: 0 }, error: null }

  const notifications = pendingManagerIds.map(id => ({
    user_id: id,
    type: 'review_reminder' as const,
    payload: { cycle_id: cycleId, kind: 'manager_review' },
  }))

  const { error } = await supabase.from('notifications').insert(notifications)
  if (error) return { data: null, error: error.message }

  await supabase.from('audit_logs').insert({
    changed_by: user.id,
    action: 'send_reminders',
    entity_type: 'cycle',
    entity_id: cycleId,
    new_value: { kind: 'manager_review', count: pendingManagerIds.length },
  })

  revalidatePath(`/admin/cycles/${cycleId}`)
  return { data: { sent: pendingManagerIds.length }, error: null }
}
```

**Step 2: Write the page**

`src/app/(dashboard)/admin/cycles/[id]/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { CycleStatusBadge } from '@/components/cycle-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/submit-button'
import Link from 'next/link'
import { advanceCycleStatus } from '../actions'
import { sendSelfReviewReminders, sendManagerReviewReminders } from './actions'
import { getNextStatus } from '@/lib/cycle-machine'
import { CYCLE_STATUS_LABELS } from '@/lib/constants'
import type { Cycle, User, Review, Appraisal } from '@/lib/types'

function daysUntil(d: string | null) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

export default async function CycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin'])
  const { id } = await params
  const supabase = await createClient()

  const { data: cycle } = await supabase.from('cycles').select('*').eq('id', id).single()
  if (!cycle) notFound()

  const [usersRes, reviewsRes, appraisalsRes] = await Promise.all([
    supabase.from('users').select('id, full_name, department, manager_id, role').eq('is_active', true).neq('role', 'admin').neq('role', 'hrbp'),
    supabase.from('reviews').select('employee_id, status').eq('cycle_id', id),
    supabase.from('appraisals').select('employee_id, manager_id, manager_submitted_at, final_rating').eq('cycle_id', id),
  ])

  const users = (usersRes.data as Pick<User, 'id' | 'full_name' | 'department' | 'manager_id' | 'role'>[]) ?? []
  const reviews = (reviewsRes.data ?? []) as Pick<Review, 'employee_id' | 'status'>[]
  const appraisals = (appraisalsRes.data ?? []) as Pick<Appraisal, 'employee_id' | 'manager_id' | 'manager_submitted_at' | 'final_rating'>[]

  const reviewMap = new Map(reviews.map(r => [r.employee_id, r]))
  const appraisalMap = new Map(appraisals.map(a => [a.employee_id, a]))
  const userMap = new Map(users.map(u => [u.id, u]))

  const employees = users.filter(u => u.role === 'employee')
  const deadlineDays = daysUntil((cycle as Cycle).manager_review_deadline)
  const isOverdue = deadlineDays !== null && deadlineDays < 0

  const pendingSelfReviews = employees.filter(e => reviewMap.get(e.id)?.status !== 'submitted').length
  const pendingManagerReviews = employees.filter(e => !appraisalMap.get(e.id)?.manager_submitted_at).length

  const next = getNextStatus((cycle as Cycle).status)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link href="/admin/cycles" className="text-muted-foreground hover:underline text-sm">← Cycles</Link>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{(cycle as Cycle).name}</h1>
            <CycleStatusBadge status={(cycle as Cycle).status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {(cycle as Cycle).quarter} {(cycle as Cycle).year}
            {(cycle as Cycle).manager_review_deadline && (
              <> · Manager deadline: {new Date((cycle as Cycle).manager_review_deadline!).toLocaleDateString()}
                {isOverdue && <span className="ml-1 text-destructive font-medium">(overdue)</span>}
              </>
            )}
          </p>
        </div>
        {next && (
          <form action={advanceCycleStatus.bind(null, id, (cycle as Cycle).status) as unknown as (fd: FormData) => Promise<void>}>
            <SubmitButton variant="outline">Advance to {CYCLE_STATUS_LABELS[next]}</SubmitButton>
          </form>
        )}
      </div>

      {/* Reminders */}
      <div className="rounded-lg border p-4 space-y-3">
        <h2 className="font-semibold text-sm">Send Reminders</h2>
        <div className="flex gap-3 flex-wrap">
          <form action={sendSelfReviewReminders.bind(null, id) as unknown as (fd: FormData) => Promise<void>}>
            <SubmitButton variant="outline" size="sm" disabled={pendingSelfReviews === 0}>
              Remind {pendingSelfReviews} pending self-review{pendingSelfReviews !== 1 ? 's' : ''}
            </SubmitButton>
          </form>
          <form action={sendManagerReviewReminders.bind(null, id) as unknown as (fd: FormData) => Promise<void>}>
            <SubmitButton variant="outline" size="sm" disabled={pendingManagerReviews === 0}>
              Remind {pendingManagerReviews} pending manager review{pendingManagerReviews !== 1 ? 's' : ''}
            </SubmitButton>
          </form>
        </div>
      </div>

      {/* Per-employee table */}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left">Employee</th>
              <th className="p-3 text-left">Department</th>
              <th className="p-3 text-left">Manager</th>
              <th className="p-3 text-left">Self Review</th>
              <th className="p-3 text-left">Manager Review</th>
              <th className="p-3 text-left">Rating</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => {
              const review = reviewMap.get(emp.id)
              const appraisal = appraisalMap.get(emp.id)
              const manager = emp.manager_id ? userMap.get(emp.manager_id) : null
              const selfDone = review?.status === 'submitted'
              const managerDone = !!appraisal?.manager_submitted_at
              const managerOverdue = isOverdue && !managerDone

              return (
                <tr key={emp.id} className="border-t">
                  <td className="p-3 font-medium">{emp.full_name}</td>
                  <td className="p-3 text-muted-foreground">{emp.department ?? '—'}</td>
                  <td className="p-3 text-muted-foreground">{manager?.full_name ?? '—'}</td>
                  <td className="p-3">
                    <Badge variant={selfDone ? 'default' : 'secondary'} className={selfDone ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : ''}>
                      {selfDone ? 'Submitted' : 'Pending'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant={managerDone ? 'default' : 'secondary'}
                      className={managerDone ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : managerOverdue ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : ''}>
                      {managerDone ? 'Done' : managerOverdue ? 'Overdue' : 'Pending'}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{appraisal?.final_rating ?? '—'}</td>
                </tr>
              )
            })}
            {employees.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No employees in scope</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**Step 3: Verify**

Navigate to `/admin/cycles`, click a cycle — should show the detail page with the per-employee table.

**Step 4: Commit**

```bash
git add src/app/(dashboard)/admin/cycles/[id]/
git commit -m "feat: cycle detail page with per-employee status and reminders"
```

---

## Task 5: Users Page — Search, Filter, Inline Edits

**Files:**
- Modify: `src/app/(dashboard)/admin/users/page.tsx`
- Create: `src/app/(dashboard)/admin/users/users-table.tsx`
- Modify: `src/app/(dashboard)/admin/users/actions.ts`

**Step 1: Add `toggleUserActive` server action**

In `src/app/(dashboard)/admin/users/actions.ts`, add:

```ts
export async function toggleUserActive(userId: string, currentActive: boolean): Promise<void> {
  const user = await requireRole(['admin'])
  const supabase = await createServiceClient()

  await supabase.from('users').update({ is_active: !currentActive }).eq('id', userId)

  await supabase.from('audit_logs').insert({
    changed_by: user.id,
    action: 'toggle_active',
    entity_type: 'user',
    entity_id: userId,
    old_value: { is_active: currentActive },
    new_value: { is_active: !currentActive },
  })

  revalidatePath('/admin/users')
}
```

**Step 2: Create `users-table.tsx` client component**

`src/app/(dashboard)/admin/users/users-table.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { updateUserRole, toggleUserActive } from './actions'
import type { User } from '@/lib/types'

const ROLES = ['employee', 'manager', 'hrbp', 'admin'] as const

export function UsersTable({ users }: { users: User[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const search = searchParams.get('search') ?? ''
  const roleFilter = searchParams.get('role') ?? ''
  const deptFilter = searchParams.get('dept') ?? ''
  const activeFilter = searchParams.get('active') ?? ''

  const [, startTransition] = useTransition()

  const departments = [...new Set(users.map(u => u.department).filter(Boolean))].sort() as string[]

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    value ? params.set(key, value) : params.delete(key)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const filtered = users.filter(u => {
    if (search && !u.full_name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false
    if (roleFilter && u.role !== roleFilter) return false
    if (deptFilter && u.department !== deptFilter) return false
    if (activeFilter === 'active' && !u.is_active) return false
    if (activeFilter === 'inactive' && u.is_active) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search name or email…"
          value={search}
          onChange={e => updateParam('search', e.target.value)}
          className="max-w-xs"
        />
        <select
          value={roleFilter}
          onChange={e => updateParam('role', e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={deptFilter}
          onChange={e => updateParam('dept', e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={activeFilter}
          onChange={e => updateParam('active', e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <p className="text-xs text-muted-foreground">Showing {filtered.length} of {users.length} users</p>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Department</th>
              <th className="p-3 text-left">Designation</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} className="border-t">
                <td className="p-3 font-medium">{u.full_name}</td>
                <td className="p-3 text-muted-foreground">{u.email}</td>
                <td className="p-3 text-muted-foreground">{u.department ?? '—'}</td>
                <td className="p-3 text-muted-foreground">{u.designation ?? '—'}</td>
                <td className="p-3">
                  <select
                    defaultValue={u.role}
                    onChange={e => startTransition(() => updateUserRole(u.id, e.target.value))}
                    className="rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="p-3">
                  <button
                    onClick={() => startTransition(() => toggleUserActive(u.id, u.is_active))}
                    className={`text-xs rounded-full px-2 py-0.5 font-medium transition-colors ${
                      u.is_active
                        ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    }`}
                  >
                    {u.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No users match your filters</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**Step 3: Update the users page**

Replace `src/app/(dashboard)/admin/users/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { triggerZimyoSync } from './actions'
import { SubmitButton } from '@/components/submit-button'
import { UsersTable } from './users-table'
import Link from 'next/link'
import type { User } from '@/lib/types'

export default async function AdminUsersPage() {
  await requireRole(['admin'])
  const supabase = await createClient()
  const { data: users } = await supabase.from('users').select('*').order('full_name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <div className="flex gap-2">
          <Link href="/admin/users/upload">
            <Button variant="outline">Upload CSV</Button>
          </Link>
          <form action={triggerZimyoSync as unknown as (fd: FormData) => Promise<void>}>
            <SubmitButton>Sync from Zimyo</SubmitButton>
          </form>
        </div>
      </div>

      {(!users || users.length === 0) ? (
        <p className="text-muted-foreground">No users yet — upload a CSV or sync with Zimyo.</p>
      ) : (
        <UsersTable users={users as User[]} />
      )}
    </div>
  )
}
```

**Step 4: Verify**

Navigate to `/admin/users`. Confirm search input filters the table. Change a role dropdown — role should update. Click an Active badge — should toggle to Inactive.

**Step 5: Commit**

```bash
git add src/app/(dashboard)/admin/users/
git commit -m "feat: users page search/filter + inline role and status editing"
```

---

## Task 6: KPI Template Management

**Files:**
- Create: `src/app/(dashboard)/admin/kpi-templates/page.tsx`
- Create: `src/app/(dashboard)/admin/kpi-templates/new/page.tsx`
- Create: `src/app/(dashboard)/admin/kpi-templates/[id]/edit/page.tsx`
- Create: `src/app/(dashboard)/admin/kpi-templates/actions.ts`

**Step 1: Write server actions**

`src/app/(dashboard)/admin/kpi-templates/actions.ts`:

```ts
'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ActionResult } from '@/lib/types'

function parseTemplateForm(formData: FormData) {
  return {
    role_slug: (formData.get('role_slug') as string).trim(),
    title: (formData.get('title') as string).trim(),
    description: (formData.get('description') as string | null)?.trim() || null,
    unit: formData.get('unit') as string,
    target: formData.get('target') ? Number(formData.get('target')) : null,
    weight: formData.get('weight') ? Number(formData.get('weight')) : null,
    category: formData.get('category') as string,
    sort_order: Number(formData.get('sort_order') || 0),
    is_active: formData.get('is_active') === 'true',
  }
}

export async function createKpiTemplate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole(['admin'])
  const supabase = await createServiceClient()
  const data = parseTemplateForm(formData)

  if (!data.role_slug) return { data: null, error: 'Role slug is required' }
  if (!data.title) return { data: null, error: 'Title is required' }

  const { error } = await supabase.from('kpi_templates').insert(data)
  if (error) return { data: null, error: error.message }

  revalidatePath('/admin/kpi-templates')
  redirect('/admin/kpi-templates')
}

export async function updateKpiTemplate(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireRole(['admin'])
  const supabase = await createServiceClient()
  const data = parseTemplateForm(formData)

  if (!data.role_slug) return { data: null, error: 'Role slug is required' }
  if (!data.title) return { data: null, error: 'Title is required' }

  const { error } = await supabase.from('kpi_templates').update(data).eq('id', id)
  if (error) return { data: null, error: error.message }

  revalidatePath('/admin/kpi-templates')
  redirect('/admin/kpi-templates')
}

export async function toggleTemplateActive(id: string, current: boolean): Promise<void> {
  await requireRole(['admin'])
  const supabase = await createServiceClient()
  await supabase.from('kpi_templates').update({ is_active: !current }).eq('id', id)
  revalidatePath('/admin/kpi-templates')
}
```

**Step 2: Write the list page**

`src/app/(dashboard)/admin/kpi-templates/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { toggleTemplateActive } from './actions'
import type { KpiTemplate } from '@/lib/types'

const CATEGORY_LABELS = { performance: 'Performance', behaviour: 'Behaviour', learning: 'Learning' }

export default async function KpiTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  await requireRole(['admin'])
  const { category } = await searchParams
  const supabase = await createClient()

  let query = supabase.from('kpi_templates').select('*').order('role_slug').order('sort_order')
  if (category) query = query.eq('category', category)

  const { data: templates } = await query

  const grouped = ((templates ?? []) as KpiTemplate[]).reduce<Record<string, KpiTemplate[]>>((acc, t) => {
    acc[t.role_slug] = [...(acc[t.role_slug] ?? []), t]
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">KPI Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">Reusable KPI blueprints by role</p>
        </div>
        <Link href="/admin/kpi-templates/new">
          <Button>New Template</Button>
        </Link>
      </div>

      {/* Category filter */}
      <div className="flex gap-2">
        {[{ value: '', label: 'All' }, { value: 'performance', label: 'Performance' }, { value: 'behaviour', label: 'Behaviour' }, { value: 'learning', label: 'Learning' }].map(opt => (
          <Link key={opt.value} href={opt.value ? `/admin/kpi-templates?category=${opt.value}` : '/admin/kpi-templates'}>
            <Button variant={category === opt.value || (!category && !opt.value) ? 'default' : 'outline'} size="sm">
              {opt.label}
            </Button>
          </Link>
        ))}
      </div>

      {Object.entries(grouped).map(([slug, items]) => (
        <div key={slug} className="rounded-lg border">
          <div className="px-4 py-2 bg-muted/50 border-b">
            <h2 className="font-semibold text-sm capitalize">{slug.replace(/_/g, ' ')}</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="p-3 text-left">Title</th>
                <th className="p-3 text-left">Category</th>
                <th className="p-3 text-left">Unit</th>
                <th className="p-3 text-left">Target</th>
                <th className="p-3 text-left">Weight</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(t => (
                <tr key={t.id} className="border-t">
                  <td className="p-3 font-medium">{t.title}</td>
                  <td className="p-3"><Badge variant="outline">{CATEGORY_LABELS[t.category as keyof typeof CATEGORY_LABELS]}</Badge></td>
                  <td className="p-3 text-muted-foreground">{t.unit}</td>
                  <td className="p-3 text-muted-foreground">{t.target ?? '—'}</td>
                  <td className="p-3 text-muted-foreground">{t.weight ? `${t.weight}%` : '—'}</td>
                  <td className="p-3">
                    <form action={toggleTemplateActive.bind(null, t.id, t.is_active) as unknown as (fd: FormData) => Promise<void>}>
                      <button type="submit" className={`text-xs rounded-full px-2 py-0.5 font-medium ${t.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                        {t.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </form>
                  </td>
                  <td className="p-3">
                    <Link href={`/admin/kpi-templates/${t.id}/edit`} className="text-xs text-primary hover:underline">Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {Object.keys(grouped).length === 0 && (
        <p className="text-muted-foreground text-sm">No templates found.</p>
      )}
    </div>
  )
}
```

**Step 3: Write the shared template form component**

Create `src/app/(dashboard)/admin/kpi-templates/template-form.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/submit-button'
import Link from 'next/link'
import type { ActionResult, KpiTemplate } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

interface Props {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  defaultValues?: Partial<KpiTemplate>
}

export function TemplateForm({ action, defaultValues = {} }: Props) {
  const [state, formAction] = useActionState(action, INITIAL)

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="role_slug">Role Slug <span className="text-destructive">*</span></Label>
          <Input id="role_slug" name="role_slug" defaultValue={defaultValues.role_slug} placeholder="e.g. software_engineer" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
          <Input id="title" name="title" defaultValue={defaultValues.title} required />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <textarea id="description" name="description" defaultValue={defaultValues.description ?? ''} rows={2}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <select id="category" name="category" defaultValue={defaultValues.category ?? 'performance'}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm">
            <option value="performance">Performance</option>
            <option value="behaviour">Behaviour</option>
            <option value="learning">Learning</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit">Unit</Label>
          <select id="unit" name="unit" defaultValue={defaultValues.unit ?? 'percent'}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm">
            <option value="percent">Percent (%)</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="rating">Rating (1-5)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sort_order">Sort Order</Label>
          <Input id="sort_order" name="sort_order" type="number" defaultValue={defaultValues.sort_order ?? 0} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="target">Target</Label>
          <Input id="target" name="target" type="number" step="0.01" defaultValue={defaultValues.target ?? ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="weight">Weight (%)</Label>
          <Input id="weight" name="weight" type="number" step="0.01" min="0.01" max="100" defaultValue={defaultValues.weight ?? ''} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input id="is_active" name="is_active" type="checkbox" value="true" defaultChecked={defaultValues.is_active !== false} className="rounded" />
        <Label htmlFor="is_active">Active</Label>
      </div>

      <div className="flex gap-3 pt-2">
        <Link href="/admin/kpi-templates"><Button type="button" variant="outline">Cancel</Button></Link>
        <SubmitButton>Save Template</SubmitButton>
      </div>
    </form>
  )
}
```

**Step 4: Write create and edit pages**

`src/app/(dashboard)/admin/kpi-templates/new/page.tsx`:
```tsx
import { requireRole } from '@/lib/auth'
import { TemplateForm } from '../template-form'
import { createKpiTemplate } from '../actions'

export default async function NewKpiTemplatePage() {
  await requireRole(['admin'])
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">New KPI Template</h1>
      <TemplateForm action={createKpiTemplate} />
    </div>
  )
}
```

`src/app/(dashboard)/admin/kpi-templates/[id]/edit/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { TemplateForm } from '../../template-form'
import { updateKpiTemplate } from '../../actions'
import type { KpiTemplate } from '@/lib/types'

export default async function EditKpiTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin'])
  const { id } = await params
  const supabase = await createClient()

  const { data: template } = await supabase.from('kpi_templates').select('*').eq('id', id).single()
  if (!template) notFound()

  const boundAction = updateKpiTemplate.bind(null, id)
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Edit KPI Template</h1>
      <TemplateForm action={boundAction} defaultValues={template as KpiTemplate} />
    </div>
  )
}
```

**Step 5: Verify**

Navigate to `/admin/kpi-templates` — should show all seeded templates grouped by role. Click "Edit" on one — should load the form with pre-filled values. Click "New Template" — form should be blank.

**Step 6: Commit**

```bash
git add src/app/(dashboard)/admin/kpi-templates/
git commit -m "feat: KPI template management — list, create, edit"
```

---

## Task 7: Manual Notifications

**Files:**
- Create: `src/app/(dashboard)/admin/notifications/page.tsx`
- Create: `src/app/(dashboard)/admin/notifications/actions.ts`
- Create: `src/app/(dashboard)/admin/notifications/notification-form.tsx`

**Step 1: Write the server action**

`src/app/(dashboard)/admin/notifications/actions.ts`:

```ts
'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export interface NotificationSummary {
  sent: number
  scope: string
}

export async function sendManualNotification(
  _prev: ActionResult<NotificationSummary>,
  formData: FormData
): Promise<ActionResult<NotificationSummary>> {
  const user = await requireRole(['admin'])
  const supabase = await createServiceClient()

  const message = (formData.get('message') as string).trim()
  const link = (formData.get('link') as string | null)?.trim() || null
  const recipientType = formData.get('recipient_type') as string

  if (!message) return { data: null, error: 'Message is required' }

  let userIds: string[] = []
  let scope = ''

  if (recipientType === 'individual') {
    const userId = formData.get('user_id') as string
    if (!userId) return { data: null, error: 'Select a user' }
    userIds = [userId]
    scope = 'individual'
  } else if (recipientType === 'role') {
    const roles = formData.getAll('roles') as string[]
    if (roles.length === 0) return { data: null, error: 'Select at least one role' }
    const { data } = await supabase.from('users').select('id').in('role', roles).eq('is_active', true)
    userIds = (data ?? []).map(u => u.id)
    scope = `role:${roles.join(',')}`
  } else if (recipientType === 'department') {
    const depts = formData.getAll('departments') as string[]
    if (depts.length === 0) return { data: null, error: 'Select at least one department' }
    const { data } = await supabase.from('users').select('id').in('department', depts).eq('is_active', true)
    userIds = (data ?? []).map(u => u.id)
    scope = `dept:${depts.join(',')}`
  } else {
    const { data } = await supabase.from('users').select('id').eq('is_active', true)
    userIds = (data ?? []).map(u => u.id)
    scope = 'everyone'
  }

  if (userIds.length === 0) return { data: null, error: 'No users matched the recipient selection' }

  const notifications = userIds.map(userId => ({
    user_id: userId,
    type: 'admin_message' as const,
    payload: { message, link },
  }))

  const { error } = await supabase.from('notifications').insert(notifications)
  if (error) return { data: null, error: error.message }

  await supabase.from('audit_logs').insert({
    changed_by: user.id,
    action: 'manual_notification',
    entity_type: 'notification',
    new_value: { scope, count: userIds.length, message: message.slice(0, 100) },
  })

  revalidatePath('/admin/notifications')
  return { data: { sent: userIds.length, scope }, error: null }
}
```

**Step 2: Write the client notification form**

`src/app/(dashboard)/admin/notifications/notification-form.tsx`:

```tsx
'use client'

import { useState, useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { sendManualNotification, type NotificationSummary } from './actions'
import type { User, ActionResult } from '@/lib/types'

const INITIAL: ActionResult<NotificationSummary> = { data: null, error: null }
const ROLES = ['employee', 'manager', 'hrbp'] as const

function SendButton() {
  const { pending } = useFormStatus()
  return <Button type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send Notification'}</Button>
}

export function NotificationForm({ users, departments }: { users: Pick<User, 'id' | 'full_name' | 'email'>[]; departments: string[] }) {
  const [recipientType, setRecipientType] = useState<'individual' | 'role' | 'department' | 'everyone'>('everyone')
  const [state, action] = useActionState(sendManualNotification, INITIAL)

  return (
    <form action={action} className="space-y-5">
      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}
      {state.data && (
        <p className="rounded-md bg-green-50 dark:bg-green-950/30 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          Sent to {state.data.sent} user{state.data.sent !== 1 ? 's' : ''} ({state.data.scope})
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="message">Message <span className="text-destructive">*</span></Label>
        <textarea id="message" name="message" rows={3} required
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Reminder: self-review deadline is Friday…" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="link">Link (optional)</Label>
        <Input id="link" name="link" placeholder="/employee or /admin/cycles/…" />
      </div>

      {/* Recipient type */}
      <div className="space-y-2">
        <Label>Recipients</Label>
        <div className="flex flex-wrap gap-2">
          {(['individual', 'role', 'department', 'everyone'] as const).map(t => (
            <button key={t} type="button" onClick={() => setRecipientType(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors border ${recipientType === t ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted border-input'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <input type="hidden" name="recipient_type" value={recipientType} />
      </div>

      {recipientType === 'individual' && (
        <div className="space-y-1.5">
          <Label htmlFor="user_id">User</Label>
          <select id="user_id" name="user_id" className="w-full rounded-md border bg-background px-3 py-1.5 text-sm">
            <option value="">— select user —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
          </select>
        </div>
      )}

      {recipientType === 'role' && (
        <div className="space-y-2">
          <Label>Roles</Label>
          {ROLES.map(r => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="roles" value={r} defaultChecked />
              <span className="capitalize">{r}</span>
            </label>
          ))}
        </div>
      )}

      {recipientType === 'department' && (
        <div className="space-y-2">
          <Label>Departments</Label>
          <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border p-2">
            {departments.map(d => (
              <label key={d} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="departments" value={d} defaultChecked />
                <span>{d}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <SendButton />
    </form>
  )
}
```

**Step 3: Write the page**

`src/app/(dashboard)/admin/notifications/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { NotificationForm } from './notification-form'
import type { User } from '@/lib/types'

export default async function AdminNotificationsPage() {
  await requireRole(['admin'])
  const supabase = await createClient()

  const [usersRes, historyRes] = await Promise.all([
    supabase.from('users').select('id, full_name, email').eq('is_active', true).order('full_name'),
    supabase.from('audit_logs')
      .select('id, created_at, new_value, users!audit_logs_changed_by_fkey(full_name)')
      .eq('action', 'manual_notification')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const users = (usersRes.data ?? []) as Pick<User, 'id' | 'full_name' | 'email'>[]
  const departments = [...new Set(
    (await supabase.from('users').select('department').eq('is_active', true)).data
      ?.map(u => u.department).filter(Boolean) as string[]
  )].sort()

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Send Notification</h1>
        <p className="text-sm text-muted-foreground mt-1">Send an in-app message to users</p>
      </div>

      <NotificationForm users={users} departments={departments} />

      {/* Sent history */}
      {(historyRes.data ?? []).length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Recent Sends</h2>
          <div className="rounded-md border divide-y text-sm">
            {(historyRes.data ?? []).map((log: any) => (
              <div key={log.id} className="p-3 space-y-0.5">
                <p className="font-medium truncate">{(log.new_value as any)?.message}</p>
                <p className="text-xs text-muted-foreground">
                  {(log.new_value as any)?.count} recipients · {(log.new_value as any)?.scope} · by {log.users?.full_name} · {new Date(log.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 4: Verify**

Navigate to `/admin/notifications`. Select "Role", check "employee", type a message, send — should show success banner. Sent history should appear below.

**Step 5: Commit**

```bash
git add src/app/(dashboard)/admin/notifications/
git commit -m "feat: manual notifications — send to individual/role/dept/everyone"
```

---

## Task 8: Unit Tests

**Files:**
- Create: `src/lib/__tests__/admin-helpers.test.ts`

**Step 1: Write tests for the recipient-resolution logic**

The notification action's recipient logic is embedded in the server action. Extract and test the pure `buildScope` helper by writing a small unit test against the logic:

```ts
import { describe, it, expect } from 'vitest'

// Pure logic extracted from sendManualNotification
function buildScope(recipientType: string, roles: string[], depts: string[]): string {
  if (recipientType === 'individual') return 'individual'
  if (recipientType === 'role') return `role:${roles.join(',')}`
  if (recipientType === 'department') return `dept:${depts.join(',')}`
  return 'everyone'
}

describe('buildScope', () => {
  it('individual', () => expect(buildScope('individual', [], [])).toBe('individual'))
  it('role', () => expect(buildScope('role', ['employee', 'manager'], [])).toBe('role:employee,manager'))
  it('department', () => expect(buildScope('department', [], ['Engineering', 'HR'])).toBe('dept:Engineering,HR'))
  it('everyone', () => expect(buildScope('everyone', [], [])).toBe('everyone'))
})
```

**Step 2: Run tests**

```bash
npx vitest run src/lib/__tests__/admin-helpers.test.ts
```
Expected: 4 tests pass.

**Step 3: Commit**

```bash
git add src/lib/__tests__/admin-helpers.test.ts
git commit -m "test: admin notification scope helper"
```

---

## Task 9: Final Verification

**Step 1: Run full test suite**

```bash
npx vitest run
```
Expected: all tests pass, 0 failures.

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 3: Smoke test all new routes**

| Route | Check |
|---|---|
| `/admin` | Dashboard with 2 panels |
| `/admin/cycles` | Cycle list, cycle names are links |
| `/admin/cycles/[id]` | Per-employee table + reminder buttons |
| `/admin/users` | Search bar + inline role/status dropdowns |
| `/admin/kpi-templates` | Grouped table with toggle + edit |
| `/admin/kpi-templates/new` | Blank form, save redirects to list |
| `/admin/kpi-templates/[id]/edit` | Pre-filled form |
| `/admin/notifications` | Send form + history |

**Step 4: Apply cloud migration**

If not already done in Task 1, apply migration `00016_admin_overhaul.sql` to cloud project via MCP.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: admin overhaul — dashboard, cycle detail, user filters, KPI templates, notifications"
```
