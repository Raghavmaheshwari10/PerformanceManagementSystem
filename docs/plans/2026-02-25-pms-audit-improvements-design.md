# PMS Audit Improvements Design
**Date:** 2026-02-25
**Approach:** Dependency-layered (schema → security → server logic → UI/UX → code quality)
**Scope:** All 53 issues found across 5 categories — one comprehensive plan, deep restructure allowed

---

## Background

A full audit of the PMS codebase (54 files) identified 53 issues:

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Security | 2 | 5 | 4 | 0 | 11 |
| UX/Features | 2 | 4 | 4 | 2 | 12 |
| Code Quality | 0 | 2 | 5 | 2 | 9 |
| Data Integrity | 0 | 5 | 7 | 2 | 14 |
| Performance | 0 | 3 | 3 | 1 | 7 |
| **Total** | **4** | **19** | **23** | **7** | **53** |

---

## Section 1: Schema / Database

**New migration:** `supabase/migrations/00006_integrity_and_indexes.sql`

- Add `CHECK (weight > 0 AND weight <= 100)` on `kpis.weight`
- Add `CHECK (sme_multiplier >= 0 AND sme_multiplier <= 5)` on `cycles.sme_multiplier`
- Add composite index `(cycle_id, employee_id)` on `appraisals` and `kpis`
- Add composite index `(cycle_id, manager_id)` on `reviews`
- Add trigger to enforce KPI weights sum to 100 per (cycle_id, employee_id)
- Add `is_final BOOLEAN DEFAULT FALSE` column to `appraisals` — set to true when HRBP overrides a rating; prevents manager re-submission from overwriting the final value

---

## Section 2: Security Hardening

### IDOR — Manager ownership verification
- `src/lib/auth.ts`: New `requireManagerOwnership(supabase, managerId, employeeId)` helper — queries `users WHERE id = employeeId AND manager_id = managerId`
- `src/app/(dashboard)/manager/actions.ts`: All actions (`addKpi`, `deleteKpi`, `submitManagerRating`) call this helper first; error returned if ownership check fails
- `src/app/(dashboard)/manager/[employeeId]/review/page.tsx` and `kpis/page.tsx`: Server component does ownership check — redirect to `/manager` on failure

### HRBP appraisal override guard
- `src/app/(dashboard)/hrbp/actions.ts`: `overrideRating` verifies `appraisal.cycle_id === cycle_id` parameter before writing

### Cycle state machine enforcement
- `src/app/(dashboard)/hrbp/actions.ts`: `publishCycle` adds `if (cycle.status !== 'locked') throw ...`
- `src/app/(dashboard)/admin/actions.ts`: `advanceCycleStatus` uses atomic PostgreSQL function with `SELECT ... FOR UPDATE` on cycle row to prevent race condition

### Manager cannot set `final_rating`
- `src/app/(dashboard)/manager/actions.ts`: `submitManagerRating` writes to `manager_rating` field only; `final_rating` is set only during lock phase by HRBP

### CSV injection
- `src/app/(dashboard)/admin/users/upload/actions.ts`: Replace naive `.split(',')` with proper quoted CSV parser; validate email format; skip empty rows
- `src/lib/payroll-csv.ts`: Wrap all fields in quotes; escape embedded quotes

---

## Section 3: Server Action Fixes

### N+1 query elimination
- `src/app/(dashboard)/hrbp/actions.ts` — `lockCycle`: Replace per-appraisal `users` loop with single `SELECT WHERE id = ANY(...)` + in-memory map
- `src/app/(dashboard)/admin/users/actions.ts` — Zimyo sync: Replace per-employee manager update loop with single bulk `UPDATE ... SET manager_id = CASE ... END WHERE id IN (...)`
- `src/app/(dashboard)/admin/users/upload/actions.ts` — CSV upload: Batch upsert all rows in one call; batch manager links in one update

### Error propagation
- All server actions return `{ data, error }` (never throw); pages display error inline
- New shared type: `src/lib/types.ts` — `ActionResult<T>`

### KPI weight validation
- `src/app/(dashboard)/manager/actions.ts` — `addKpi`: After adding KPI, query total weight for that employee/cycle; reject if > 100 with user-facing error

### Cycle ID validation
- `src/app/(dashboard)/manager/[employeeId]/review/page.tsx`: Validate `cycleId` from `searchParams` against `cycles` table; redirect to `/manager` if invalid

---

## Section 4: UI / UX Improvements

### Loading and error states on forms
- All forms with submit actions: Use `useFormStatus` / `useTransition` to disable button and show "Saving..." during submission; display returned `error` inline
- Affected: manager review form, employee self-review form, HRBP calibration form, admin cycle creation form

### Missing pages
- `src/app/(dashboard)/manager/my-review/page.tsx` — New page showing the current manager's own self-review and manager review entries

### Empty states
- `src/app/(dashboard)/manager/[employeeId]/kpis/page.tsx`: Show "No KPIs set yet — add one below" when list is empty
- `src/app/(dashboard)/admin/users/page.tsx`: Show "No users yet" when list is empty
- `src/app/(dashboard)/hrbp/page.tsx`: Sort/group cycles — active at top, archived below

### Audit log pagination
- `src/app/(dashboard)/admin/audit-log/page.tsx` and `hrbp/audit-log/page.tsx`: Add page-based pagination (25 rows/page) with prev/next controls; remove hard-coded `.limit(200)`

### CSV upload feedback
- After upload, show summary: "N created, N updated, N skipped (reason)"; collect per-row errors instead of silently continuing

---

## Section 5: Code Quality Cleanup

### Type safety
- `src/lib/types.ts`: Add proper interfaces — `User`, `Cycle`, `KPI`, `Review`, `Appraisal`, `AuditLog`; replace all `any` casts in HRBP calibration page, admin audit log page, and action files

### Deduplicate audit log pages
- Extract `<AuditLogTable logs={logs} />` shared component; both admin and HRBP pages use it — removes ~40 lines of duplication

### Authorization helper
- `src/lib/auth.ts`: `requireManagerOwnership(supabase, managerId, employeeId): Promise<boolean>` — all manager actions import and call this

### Validation utilities
- `src/lib/validate.ts`: `validateEmail(str)`, `validateWeight(n)`, `validateMultiplier(n)` — imported by all action files

### CSV utilities
- `src/lib/csv.ts`: Extract CSV parser and writer from upload action and payroll-csv lib into one shared file

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/00006_integrity_and_indexes.sql` | New migration |
| `src/lib/types.ts` | New — shared interfaces and ActionResult |
| `src/lib/auth.ts` | New — manager ownership helper |
| `src/lib/validate.ts` | New — validation utilities |
| `src/lib/csv.ts` | New — shared CSV parser/writer |
| `src/lib/payroll-csv.ts` | Fix CSV injection |
| `src/app/(dashboard)/manager/actions.ts` | IDOR fixes, manager_rating only, weight validation |
| `src/app/(dashboard)/manager/[employeeId]/review/page.tsx` | Ownership check, cycleId validation, loading state |
| `src/app/(dashboard)/manager/[employeeId]/kpis/page.tsx` | Ownership check, empty state |
| `src/app/(dashboard)/manager/my-review/page.tsx` | New page |
| `src/app/(dashboard)/hrbp/actions.ts` | Override guard, publishCycle state check, N+1 fix |
| `src/app/(dashboard)/hrbp/calibration/page.tsx` | Loading state, type safety |
| `src/app/(dashboard)/hrbp/page.tsx` | Cycle grouping |
| `src/app/(dashboard)/hrbp/audit-log/page.tsx` | Pagination, shared component |
| `src/app/(dashboard)/admin/actions.ts` | Atomic cycle transition |
| `src/app/(dashboard)/admin/users/actions.ts` | Zimyo N+1 fix, error propagation |
| `src/app/(dashboard)/admin/users/upload/actions.ts` | CSV parser fix, email validation, batch ops, summary |
| `src/app/(dashboard)/admin/users/page.tsx` | Empty state |
| `src/app/(dashboard)/admin/cycles/new/page.tsx` | Error display |
| `src/app/(dashboard)/admin/audit-log/page.tsx` | Pagination, shared component |
| `src/app/(dashboard)/employee/page.tsx` | Loading state, error display |
| `src/components/audit-log-table.tsx` | New shared component |
