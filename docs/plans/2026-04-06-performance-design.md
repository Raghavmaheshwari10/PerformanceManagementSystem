# Design: Performance Optimisation

**Date:** 2026-04-06
**Status:** Approved
**Stack:** Next.js 16, React 19, TypeScript, Prisma 7, NeonDB, Vercel
**Org scale:** ~100 employees

---

## Scope

Three targeted improvements chosen for the highest ROI at 100-employee scale:

1. Fix N+1 queries in manager dashboard (real speed)
2. Suspense + streaming on heavy pages (perceived speed)
3. Form submit spinner (UX polish)

Explicitly out of scope: heavy pagination (100 rows is fine), image optimisation (only 1 SVG), notification caching, optimistic UI rewrites.

---

## Part 1 — Fix N+1 in Manager Dashboard

### Problem

`getStatusForEmployee()` in `src/lib/cycle-helpers.ts` is called inside a `Promise.all(.map())` on the manager dashboard. Each invocation fires 3–4 separate Prisma queries:

1. `cycleEmployee.findUnique` — check per-employee override
2. `user.findUnique` — get department_id
3. `cycleDepartment.findUnique` — check department-level status
4. `cycle.findUnique` — fallback to cycle-level status

With 100 direct reports, this is up to **400 queries per page load**.

### Fix

Add a new batched function `batchGetStatusForEmployees(cycleId, employeeIds[])` to `src/lib/cycle-helpers.ts` that resolves all statuses in exactly **3 queries total**:

1. `cycleEmployee.findMany({ where: { cycle_id, employee_id: { in: employeeIds } } })` — all overrides
2. `user.findMany({ where: { id: { in: employeeIds } }, select: { id, department_id } })` — all dept IDs
3. `cycleDepartment.findMany({ where: { cycle_id, department_id: { in: deptIds } } })` — all dept statuses

Then resolve each employee's effective status in-memory using Maps — same logic as the existing function, just applied across the batch.

Update `src/app/(dashboard)/manager/page.tsx` to call `batchGetStatusForEmployees` once instead of mapping over `getStatusForEmployee`.

The original `getStatusForEmployee` is left unchanged for any single-employee callers.

---

## Part 2 — Suspense + Streaming on Heavy Pages

### Problem

All dashboard pages `await` their full data before rendering. The user sees nothing until the slowest query completes. On a cold Neon serverless connection, this can be 500ms–2s.

### Fix

Extract slow data-fetching into dedicated async `*Content` server components. Wrap them in `<Suspense fallback={<Skeleton />}>`. The page shell (sidebar, topbar, headings) renders in the first flush. Content streams in as queries resolve.

### Pages

**`/manager` (manager dashboard)**
- Extract employee status cards into `ManagerEmployeesContent` async component
- Wrap with `<Suspense fallback={<CardGridSkeleton />}>`
- Shell + header render instantly; employee cards stream in

**`/admin/users` (admin users table)**
- Extract `UsersTable` data fetch into `UsersContent` async component
- Wrap with `<Suspense fallback={<TableSkeleton />}>`

**`/hrbp/employees` (HRBP employee directory)**
- Extract employee list into `EmployeesContent` async component
- Wrap with `<Suspense fallback={<TableSkeleton />}>`

### Shared Skeleton Components

Two reusable skeletons added to `src/components/skeletons.tsx`:

- `TableSkeleton` — animates a grey table with configurable row count
- `CardGridSkeleton` — animates a 2–3 column grid of grey card placeholders

Both use Tailwind `animate-pulse` — no external libraries.

---

## Part 3 — Form Submit Spinner

### Problem

`SubmitButton` already uses `useFormStatus` and disables the button while pending. However it shows **no spinner icon**, so the disabled state is nearly invisible — users cannot tell if their click registered.

### Fix

Update `src/components/submit-button.tsx` to render a `Loader2` (lucide-react) spinning icon alongside the label when `pending` is true. No changes needed to any of the 32+ forms that use `SubmitButton` — the fix is in one place.

```
Before: [  Save Changes  ]   ← button just greyed out, no motion
After:  [ ⟳ Saving…     ]   ← spinner + pendingLabel or "Saving…"
```

Default pending label falls back to "Saving…" if the caller doesn't pass `pendingLabel`.

---

## New Files

| File | Purpose |
|------|---------|
| `src/lib/cycle-helpers.ts` | Add `batchGetStatusForEmployees` |
| `src/components/skeletons.tsx` | `TableSkeleton`, `CardGridSkeleton` |
| `src/components/submit-button.tsx` | Add spinner icon when pending |
| `src/app/(dashboard)/manager/page.tsx` | Use batched status fn + Suspense |
| `src/app/(dashboard)/admin/users/page.tsx` | Suspense wrapper |
| `src/app/(dashboard)/hrbp/employees/page.tsx` | Suspense wrapper |
