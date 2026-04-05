# Performance Optimisation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate the N+1 query bottleneck on the manager dashboard, add Suspense streaming to three heavy pages so the shell renders instantly, and add a loading spinner to all 32+ form submit buttons in one change.

**Architecture:** Three independent improvements: (1) a new batched DB function replaces the per-employee query loop in cycle-helpers.ts, (2) async content components + Suspense boundaries on admin/users, hrbp/employees, and manager dashboard pages, (3) a one-line spinner addition to the shared SubmitButton component.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 7, Tailwind v4, lucide-react

---

## PART 1 — Fix N+1 in Manager Dashboard

---

### Task 1: Add `batchGetStatusForEmployees` to cycle-helpers.ts

**Files:**
- Modify: `src/lib/cycle-helpers.ts` (add new export after line 50)

**Context:** The existing `getStatusForEmployee(cycleId, employeeId)` runs 3–4 DB queries per employee. When called in a `.map()` loop on the manager page with 100 employees, it fires up to 400 queries per page load. The new batched version replaces all of those with 4 queries total regardless of employee count.

**Status resolution priority (same as existing function):**
1. `CycleEmployee.excluded = true` → return `'draft'`
2. `CycleEmployee.status_override` is set → return it
3. Employee's `department_id` has a `CycleDepartment` row for this cycle → return that status
4. Fallback → cycle's own status

**Step 1: Add the function**

Open `src/lib/cycle-helpers.ts`. After the closing `}` of `getStatusForEmployee` (after line 50), insert this new export:

```typescript
/**
 * Batch version of getStatusForEmployee — resolves all statuses in 4 queries
 * regardless of how many employees are in the list. Use this instead of
 * mapping over getStatusForEmployee in a loop.
 *
 * Returns a Map<employeeId, CycleStatus>.
 */
export async function batchGetStatusForEmployees(
  cycleId: string,
  employeeIds: string[]
): Promise<Map<string, CycleStatus>> {
  if (employeeIds.length === 0) return new Map()

  // Query 1+2+3 in parallel: overrides, employee dept IDs, cycle fallback status
  const [overrides, users, cycle] = await Promise.all([
    prisma.cycleEmployee.findMany({
      where: { cycle_id: cycleId, employee_id: { in: employeeIds } },
      select: { employee_id: true, status_override: true, excluded: true },
    }),
    prisma.user.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, department_id: true },
    }),
    prisma.cycle.findUnique({
      where: { id: cycleId },
      select: { status: true },
    }),
  ])

  // Query 4: department-level statuses for all relevant depts
  const deptIds = [
    ...new Set(
      users.map(u => u.department_id).filter((id): id is string => id !== null)
    ),
  ]
  const deptStatuses =
    deptIds.length > 0
      ? await prisma.cycleDepartment.findMany({
          where: { cycle_id: cycleId, department_id: { in: deptIds } },
          select: { department_id: true, status: true },
        })
      : []

  // Build lookup maps
  const overrideMap = new Map(overrides.map(o => [o.employee_id, o]))
  const userDeptMap = new Map(users.map(u => [u.id, u.department_id]))
  const deptStatusMap = new Map(deptStatuses.map(d => [d.department_id, d.status]))
  const cycleStatus: CycleStatus = cycle?.status ?? 'draft'

  // Resolve each employee's effective status in-memory
  const result = new Map<string, CycleStatus>()
  for (const empId of employeeIds) {
    const override = overrideMap.get(empId)
    if (override?.excluded) {
      result.set(empId, 'draft')
      continue
    }
    if (override?.status_override) {
      result.set(empId, override.status_override)
      continue
    }
    const deptId = userDeptMap.get(empId)
    if (deptId) {
      const deptStatus = deptStatusMap.get(deptId)
      if (deptStatus) {
        result.set(empId, deptStatus)
        continue
      }
    }
    result.set(empId, cycleStatus)
  }

  return result
}
```

**Step 2: TypeScript check**

```bash
cd "C:\Users\Raghav Maheshwari\Performance-System-hRMS\.claude\worktrees\charming-bouman"
npx tsc --noEmit
```

Expected: zero errors.

**Step 3: Commit**

```bash
git add src/lib/cycle-helpers.ts
git commit -m "perf: add batchGetStatusForEmployees — 4 queries instead of N*4"
```

---

### Task 2: Use batch function in manager dashboard

**Files:**
- Modify: `src/app/(dashboard)/manager/page.tsx`

**Context:** Line 131 in manager/page.tsx calls `getStatusForEmployee` per employee in a `Promise.all(.map())`. Replace with the new batched function. The resolved value changes from an array (indexed) to a Map (by employee ID).

**Step 1: Update the import**

Find this import at the top of `src/app/(dashboard)/manager/page.tsx`:
```typescript
import { getActiveCyclesForManager, getStatusForEmployee, type CycleWithDepartments } from '@/lib/cycle-helpers'
```

Replace with:
```typescript
import { getActiveCyclesForManager, batchGetStatusForEmployees, type CycleWithDepartments } from '@/lib/cycle-helpers'
```

**Step 2: Replace the N+1 call**

Find this block (around lines 130–138):
```typescript
    // Resolve per-employee status (respects CycleEmployee override → CycleDepartment → Cycle fallback)
    const resolvedStatuses = await Promise.all(
      cycleEmployees.map(emp => getStatusForEmployee(cycle.id, emp.id))
    )

    const statuses: EmployeeStatus[] = cycleEmployees.map((emp, i) => ({
      employee: emp as unknown as User,
      kpiCount: kpiCounts.get(emp.id) ?? 0,
      selfReviewStatus: reviewMap.has(emp.id)
        ? (reviewMap.get(emp.id) === 'submitted' ? 'submitted' : 'draft')
        : 'not_started',
      managerReviewStatus: appraisalMap.get(emp.id) ? 'submitted' : 'pending',
      resolvedStatus: resolvedStatuses[i],
    }))
```

Replace with:
```typescript
    // Batch-resolve all employee statuses in 4 queries total
    const statusMap = await batchGetStatusForEmployees(
      cycle.id,
      cycleEmployees.map(e => e.id)
    )

    const statuses: EmployeeStatus[] = cycleEmployees.map((emp) => ({
      employee: emp as unknown as User,
      kpiCount: kpiCounts.get(emp.id) ?? 0,
      selfReviewStatus: reviewMap.has(emp.id)
        ? (reviewMap.get(emp.id) === 'submitted' ? 'submitted' : 'draft')
        : 'not_started',
      managerReviewStatus: appraisalMap.get(emp.id) ? 'submitted' : 'pending',
      resolvedStatus: statusMap.get(emp.id) ?? 'draft',
    }))
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

**Step 4: Commit**

```bash
git add "src/app/(dashboard)/manager/page.tsx"
git commit -m "perf: replace per-employee status loop with batchGetStatusForEmployees"
```

---

## PART 2 — Suspense + Streaming

---

### Task 3: Create shared skeleton components

**Files:**
- Create: `src/components/skeletons.tsx`

**Context:** These are reusable Tailwind `animate-pulse` skeletons used as Suspense fallbacks. `TableSkeleton` looks like a table with headers + rows. `CardGridSkeleton` looks like a 2-column grid of cards.

**Step 1: Create the file**

```typescript
// Reusable Suspense fallback skeletons — animate-pulse, no external deps

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-2">
      {/* Header row */}
      <div className="flex gap-4 rounded-lg border bg-muted/30 px-4 py-3">
        <div className="h-3 w-32 rounded bg-muted" />
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-3 w-28 rounded bg-muted" />
        <div className="ml-auto h-3 w-16 rounded bg-muted" />
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 rounded-lg border px-4 py-3">
          <div className="h-3 w-36 rounded bg-muted/60" />
          <div className="h-3 w-20 rounded bg-muted/60" />
          <div className="h-3 w-28 rounded bg-muted/60" />
          <div className="ml-auto h-3 w-14 rounded bg-muted/60" />
        </div>
      ))}
    </div>
  )
}

export function CardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="animate-pulse grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-muted/20 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-muted" />
            <div className="space-y-1.5">
              <div className="h-3 w-28 rounded bg-muted" />
              <div className="h-2.5 w-20 rounded bg-muted/70" />
            </div>
          </div>
          <div className="space-y-2 pt-1">
            <div className="h-2.5 w-full rounded bg-muted/50" />
            <div className="h-2.5 w-3/4 rounded bg-muted/50" />
          </div>
          <div className="h-6 w-20 rounded bg-muted/40" />
        </div>
      ))}
    </div>
  )
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/skeletons.tsx
git commit -m "feat: add TableSkeleton and CardGridSkeleton Suspense fallback components"
```

---

### Task 4: Suspense on Admin Users page

**Files:**
- Modify: `src/app/(dashboard)/admin/users/page.tsx`

**Context:** Currently the whole page awaits `prisma.user.findMany` before rendering. Split into: (1) immediate shell with heading + buttons, (2) `UsersContent` async component that fetches data and renders `UsersTable`, wrapped in Suspense.

**Step 1: Rewrite the file**

Replace the entire content of `src/app/(dashboard)/admin/users/page.tsx` with:

```typescript
import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { UsersTable } from './users-table'
import { TableSkeleton } from '@/components/skeletons'
import Link from 'next/link'
import type { User } from '@/lib/types'

export default async function AdminUsersPage() {
  await requireRole(['admin'])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <div className="flex gap-2">
          <Link href="/admin/users/new">
            <Button size="sm">+ New User</Button>
          </Link>
          <Link href="/admin/users/upload">
            <Button variant="outline">Upload CSV</Button>
          </Link>
        </div>
      </div>

      <Suspense fallback={<TableSkeleton rows={8} />}>
        <UsersContent />
      </Suspense>
    </div>
  )
}

async function UsersContent() {
  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      orderBy: { full_name: 'asc' },
      include: { department: true },
    }),
    prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  if (users.length === 0) {
    return (
      <p className="text-muted-foreground">No users yet — add a user or upload a CSV.</p>
    )
  }

  return <UsersTable users={users as unknown as User[]} departments={departments} />
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add "src/app/(dashboard)/admin/users/page.tsx"
git commit -m "perf: add Suspense streaming to admin users page"
```

---

### Task 5: Suspense on HRBP Employees page

**Files:**
- Modify: `src/app/(dashboard)/hrbp/employees/page.tsx`

**Context:** The search form needs `departments` immediately (for the `<select>` options). Only the employee list is slow. Split: fetch departments in the shell component, wrap only the employee list in Suspense.

**Step 1: Rewrite the file**

Replace the entire content of `src/app/(dashboard)/hrbp/employees/page.tsx` with:

```typescript
import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { TableSkeleton } from '@/components/skeletons'

export default async function EmployeeDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string }>
}) {
  await requireRole(['hrbp', 'admin'])
  const { q, dept } = await searchParams

  // Fetch departments immediately — needed for the filter <select>
  const departments = await prisma.department.findMany({ orderBy: { name: 'asc' } })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Employee Directory</h1>

      {/* Search + filter bar — GET form, no JS needed */}
      <form method="get" className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name or email…"
          className="flex-1 min-w-48 rounded border bg-background px-3 py-1.5 text-sm"
        />
        <select name="dept" defaultValue={dept} className="rounded border bg-background px-3 py-1.5 text-sm">
          <option value="">All departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button type="submit" className="rounded border px-3 py-1.5 text-sm hover:bg-accent">Search</button>
        {(q || dept) && (
          <a href="/hrbp/employees" className="rounded border px-3 py-1.5 text-sm hover:bg-accent text-muted-foreground">Clear</a>
        )}
      </form>

      <Suspense fallback={<TableSkeleton rows={6} />}>
        <EmployeesContent q={q} dept={dept} />
      </Suspense>
    </div>
  )
}

async function EmployeesContent({ q, dept }: { q?: string; dept?: string }) {
  const users = await prisma.user.findMany({
    where: {
      is_active: true,
      ...(dept ? { department_id: dept } : {}),
      ...(q
        ? {
            OR: [
              { full_name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      department: { select: { name: true } },
      manager: { select: { full_name: true } },
    },
    orderBy: { full_name: 'asc' },
    take: 100,
  })

  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground mb-2">
        {users.length} employee{users.length !== 1 ? 's' : ''}
      </p>
      {users.map(u => (
        <div key={u.id} className="flex items-center justify-between rounded border p-3 text-sm hover:bg-muted/30">
          <div>
            <p className="font-medium">{u.full_name}</p>
            <p className="text-xs text-muted-foreground">{u.email}</p>
          </div>
          <div className="text-right text-xs text-muted-foreground space-y-0.5">
            <p>{u.department?.name ?? '—'}</p>
            <p>{u.role === 'hrbp' ? 'HRBP' : u.role.charAt(0).toUpperCase() + u.role.slice(1)}</p>
            {u.manager && <p className="text-muted-foreground/70">↑ {u.manager.full_name}</p>}
          </div>
        </div>
      ))}
      {users.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">No employees found.</p>
      )}
    </div>
  )
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add "src/app/(dashboard)/hrbp/employees/page.tsx"
git commit -m "perf: add Suspense streaming to HRBP employees page"
```

---

### Task 6: Suspense on Manager Dashboard

**Files:**
- Modify: `src/app/(dashboard)/manager/page.tsx`

**Context:** The manager dashboard is 429 lines. After the N+1 fix in Task 2, the data fetching is already faster. Adding Suspense means the page title and any static chrome renders instantly while the employee cards stream in. The entire data-fetching + rendering logic moves into `ManagerTeamContent`.

**Step 1: Read the current full file**

Read `src/app/(dashboard)/manager/page.tsx` completely to understand its current structure (all imports, the `ManagerTeamPage` function, and all JSX below line 160).

**Step 2: Wrap the heavy content in Suspense**

Modify `ManagerTeamPage` to:
1. Keep only `requireRole` at the top (fast auth check)
2. Return a shell with heading + `<Suspense>` wrapping `<ManagerTeamContent />`
3. Move ALL existing logic (cycle fetching, employee fetching, status resolution, JSX rendering) into a new `async function ManagerTeamContent()` below the default export

The shell should look like:
```typescript
import { Suspense } from 'react'
import { CardGridSkeleton } from '@/components/skeletons'

export default async function ManagerTeamPage() {
  await requireRole(['manager'])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Your Team</h1>
      <Suspense fallback={<CardGridSkeleton cards={6} />}>
        <ManagerTeamContent />
      </Suspense>
    </div>
  )
}
```

And `ManagerTeamContent` is:
```typescript
async function ManagerTeamContent() {
  const user = await requireRole(['manager'])
  // ... all existing logic from the old ManagerTeamPage ...
  // ... return all existing JSX ...
}
```

**Important:** The empty-state check (`if (!hasCycles) return <div>No active cycles</div>`) moves inside `ManagerTeamContent`. The heading `<h1>Your Team</h1>` renders in the shell immediately, so remove any duplicate heading inside `ManagerTeamContent`.

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Fix any errors (typically just import ordering or the `user` variable needing to be re-fetched inside the content component).

**Step 4: Commit**

```bash
git add "src/app/(dashboard)/manager/page.tsx"
git commit -m "perf: add Suspense streaming to manager dashboard"
```

---

## PART 3 — Form Submit Spinner

---

### Task 7: Add loading spinner to SubmitButton

**Files:**
- Modify: `src/components/submit-button.tsx`

**Context:** `SubmitButton` already uses `useFormStatus` and disables the button when pending. The only missing piece is a visible spinner icon — without it, the disabled state is nearly invisible. Adding `Loader2` from lucide-react (already a project dependency) shows a spinning icon during any form submission across all 32+ forms.

**Step 1: Read the current file**

Current content of `src/components/submit-button.tsx`:
```typescript
'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import type { ComponentProps } from 'react'

type ButtonProps = ComponentProps<typeof Button>

interface SubmitButtonProps extends Omit<ButtonProps, 'formAction'> {
  pendingLabel?: string
  formAction?: (formData: FormData) => void | Promise<void>
}

export function SubmitButton({ pendingLabel, children, formAction, disabled, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus()
  return (
    <Button
      {...props}
      type="submit"
      formAction={formAction}
      disabled={disabled || pending}
      aria-disabled={disabled || pending}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  )
}
```

**Step 2: Add Loader2 spinner**

Replace the entire file with:

```typescript
'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ComponentProps } from 'react'

type ButtonProps = ComponentProps<typeof Button>

interface SubmitButtonProps extends Omit<ButtonProps, 'formAction'> {
  pendingLabel?: string
  formAction?: (formData: FormData) => void | Promise<void>
}

export function SubmitButton({ pendingLabel, children, formAction, disabled, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus()
  return (
    <Button
      {...props}
      type="submit"
      formAction={formAction}
      disabled={disabled || pending}
      aria-disabled={disabled || pending}
      className={props.className}
    >
      {pending && (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      )}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  )
}
```

**Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

**Step 4: Full build check**

```bash
npx next build 2>&1 | tail -20
```

Expected: clean build, exit code 0.

**Step 5: Commit and push**

```bash
git add src/components/submit-button.tsx
git commit -m "perf: add loading spinner to SubmitButton — visible feedback on all 32+ forms"
git push origin claude/charming-bouman:master
```

---

## Verification Checklist

After all 7 tasks:

1. `npx tsc --noEmit` → zero errors
2. `npx next build` → clean build
3. Manager dashboard: open DevTools Network tab — should see 4–6 DB round trips instead of 100+
4. Admin users page: heading + buttons appear instantly, table skeleton pulses briefly, then table loads
5. HRBP employees page: heading + search form appear instantly, list skeleton shows, then employees load
6. Any form submit button: shows spinner immediately on click, disables, re-enables after action

## Summary of New Files

| File | Change |
|------|--------|
| `src/lib/cycle-helpers.ts` | Add `batchGetStatusForEmployees` export |
| `src/components/skeletons.tsx` | New: `TableSkeleton`, `CardGridSkeleton` |
| `src/components/submit-button.tsx` | Add `Loader2` spinner when pending |
| `src/app/(dashboard)/manager/page.tsx` | Suspense shell + move logic to `ManagerTeamContent` |
| `src/app/(dashboard)/admin/users/page.tsx` | Suspense shell + `UsersContent` component |
| `src/app/(dashboard)/hrbp/employees/page.tsx` | Suspense shell + `EmployeesContent` component |
