# PMS Audit Improvements — Implementation Guide v2

> **For Claude Code:** Implement this plan task-by-task in strict layer order. Do not skip ahead. Run ``npx tsc --noEmit`` and ``npx vitest run`` after each task. Commit after each task with the specified message.

**Goal:** Fix all 53 audit issues + 7 additional gaps identified in review.

**Architecture:** Layer 1 (schema) → Layer 2 (utilities) → Layer 3 (security + server actions) → Layer 4 (UI/UX) → Layer 5 (code quality) → Layer 6 (missing features)

**Tech Stack:** Next.js 16.1.6 (App Router, Server Actions, useActionState), Supabase (PostgreSQL 17, RLS), Vitest, TypeScript, Tailwind v4, shadcn/ui.

---

## Changes from v1

### Critical fixes over the original plan:

1. **lockCycle N+1 eliminated properly** — v1 just parallelised the loop. v2 uses a single Postgres RPC ``bulk_lock_appraisals`` that does everything in one UPDATE JOIN.
2. **Zimyo sync N+1 eliminated properly** — v1 batched in groups of 100 (still N queries). v2 uses ``bulk_update_manager_links`` RPC with unnest arrays — single query.
3. **Optimistic lock on overrideRating** — v1 had a TOCTOU window. v2 adds ``.eq('is_final', false)`` to the UPDATE and checks ``count === 0`` for concurrent override detection.
4. **Deadline enforcement** — v1 had no deadline checks. v2 enforces ``self_review_deadline`` on employee submission and ``manager_review_deadline`` on manager rating.
5. **SubmitButton formAction typing** — v1 had a potential TypeScript error on dual formAction props. v2 explicitly types ``formAction`` on the component.
6. **Employee history page** — was missing from v1 entirely. v2 adds Task 23.
7. **Manager team overview status badges** — not in v1. v2 adds Task 24.
8. **Deadline display on pages** — not in v1. v2 adds Task 25.
9. **Notification sender wiring** — function exists but was not covered in v1. v2 adds Task 26.

---

## Layer 1 — Schema & Database

### Task 1: Add migration 00006

**File: ``supabase/migrations/00006_integrity_and_indexes.sql``**

```sql
-- 1. DB-level constraints
ALTER TABLE kpis ADD CONSTRAINT kpis_weight_bounds CHECK (weight IS NULL OR (weight > 0 AND weight <= 100));
ALTER TABLE cycles ADD CONSTRAINT cycles_sme_multiplier_bounds CHECK (sme_multiplier IS NULL OR (sme_multiplier >= 0 AND sme_multiplier <= 5));

-- 2. is_final column — set true when HRBP finalises; blocks manager re-submission overwrite
ALTER TABLE appraisals ADD COLUMN is_final boolean NOT NULL DEFAULT false;

-- 3. Composite index on reviews
CREATE INDEX IF NOT EXISTS idx_reviews_cycle_manager ON reviews(cycle_id, manager_id);

-- 4. KPI weight sum trigger
CREATE OR REPLACE FUNCTION check_kpi_weight_sum()
RETURNS TRIGGER AS $$
DECLARE total numeric;
BEGIN
  SELECT COALESCE(SUM(weight), 0) INTO total
  FROM kpis
  WHERE cycle_id = NEW.cycle_id AND employee_id = NEW.employee_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  IF total + COALESCE(NEW.weight, 0) > 100 THEN
    RAISE EXCEPTION 'Total KPI weight would exceed 100%% (current: %, adding: %)', total, COALESCE(NEW.weight, 0);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER kpi_weight_sum_check BEFORE INSERT OR UPDATE ON kpis FOR EACH ROW EXECUTE FUNCTION check_kpi_weight_sum();

-- 5. Bulk lock appraisals — single UPDATE JOIN, no N+1 in lockCycle
-- Skips is_final=true appraisals (already overridden by HRBP)
CREATE OR REPLACE FUNCTION bulk_lock_appraisals(p_cycle_id uuid, p_sme_multiplier numeric)
RETURNS void AS $$
BEGIN
  UPDATE appraisals a
  SET
    final_rating = COALESCE(a.final_rating, a.manager_rating),
    payout_multiplier = CASE COALESCE(a.final_rating, a.manager_rating)
      WHEN 'BE'  THEN 0
      WHEN 'ME'  THEN 1.0
      WHEN 'EE'  THEN 1.5
      WHEN 'FEE' THEN 0
      WHEN 'SME' THEN 1.0 + p_sme_multiplier
      ELSE 0
    END,
    payout_amount = u.variable_pay * CASE COALESCE(a.final_rating, a.manager_rating)
      WHEN 'BE'  THEN 0
      WHEN 'ME'  THEN 1.0
      WHEN 'EE'  THEN 1.5
      WHEN 'FEE' THEN 0
      WHEN 'SME' THEN 1.0 + p_sme_multiplier
      ELSE 0
    END,
    locked_at = now()
  FROM users u
  WHERE a.cycle_id = p_cycle_id
    AND a.employee_id = u.id
    AND a.is_final = false
    AND COALESCE(a.final_rating, a.manager_rating) IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Bulk manager-link update — single UPDATE with unnest, no N+1 in Zimyo sync
CREATE OR REPLACE FUNCTION bulk_update_manager_links(p_zimyo_ids text[], p_manager_ids uuid[])
RETURNS void AS $$
BEGIN
  UPDATE users u
  SET manager_id = m.manager_id
  FROM (SELECT unnest(p_zimyo_ids) AS zimyo_id, unnest(p_manager_ids) AS manager_id) m
  WHERE u.zimyo_id = m.zimyo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

```bash
npx supabase db reset
git add supabase/migrations/00006_integrity_and_indexes.sql
git commit -m "feat: db constraints, is_final column, kpi weight trigger, bulk lock and manager-link RPCs"
```

---

## Layer 2 — Shared Utilities

### Task 2: Validation utilities

**``src/lib/validate.ts``**
```typescript
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function validateEmail(value: string): boolean { return EMAIL_RE.test(value) }
export function validateWeight(value: number): boolean { return Number.isFinite(value) && value > 0 && value <= 100 }
export function validateMultiplier(value: number): boolean { return Number.isFinite(value) && value >= 0 && value <= 5 }
```

Write tests in ``src/lib/__tests__/validate.test.ts`` covering valid/invalid cases for each function. Run and verify all pass.

```bash
npx vitest run src/lib/__tests__/validate.test.ts
git commit -m "feat: add validation utilities with tests"
```

---

### Task 3: CSV utilities

**``src/lib/csv.ts``** — implement ``parseCsv(text, requiredColumns?)`` (RFC 4180, handles quoted fields with commas, skips empty rows, throws on missing required columns) and ``escapeCsvField(value)`` (wraps comma/quote/newline-containing fields in quotes, escapes embedded quotes).

Write tests in ``src/lib/__tests__/csv.test.ts``. Run and verify all pass.

```bash
npx vitest run src/lib/__tests__/csv.test.ts
git commit -m "feat: add RFC 4180 CSV parser and escapeCsvField utility"
```

---

### Task 4: Update types.ts

Add to ``src/lib/types.ts``:
- ``export type ActionResult<T = null> = { data: T; error: null } | { data: null; error: string }``
- Add ``is_final: boolean`` to ``Appraisal`` interface after ``locked_at``

```bash
npx tsc --noEmit
git commit -m "feat: add ActionResult type and is_final to Appraisal"
```

---

### Task 5: Auth utilities

Add to ``src/lib/auth.ts``:
- ``checkManagerOwnership(user, managerId): boolean`` — pure function, testable without DB
- ``requireManagerOwnership(employeeId, managerId): Promise<void>`` — DB-backed, calls ``redirect('/unauthorized')`` on fail

Write unit tests for ``checkManagerOwnership`` in ``src/lib/__tests__/auth.test.ts``.

```bash
npx vitest run src/lib/__tests__/auth.test.ts
npx tsc --noEmit
git commit -m "feat: add requireManagerOwnership and checkManagerOwnership"
```

---

## Layer 3 — Security & Server Action Fixes

### Task 6: Fix payroll-csv.ts (CSV injection)

Use ``escapeCsvField`` from ``@/lib/csv`` to wrap all string fields. Add injection test to ``payroll-csv.test.ts``.

```bash
npx vitest run src/lib/__tests__/payroll-csv.test.ts
git commit -m "fix: escape CSV fields in payroll export to prevent injection"
```

---

### Task 7: Fix manager/actions.ts

Rewrite with:
- ``requireManagerOwnership`` on all actions (IDOR fix)
- Write ``manager_rating`` only, never ``final_rating``
- ``validateWeight`` before insert
- Deadline check in ``submitManagerRating``: verify cycle is in ``manager_review`` status and ``manager_review_deadline`` has not passed

```bash
npx tsc --noEmit
git commit -m "fix: IDOR ownership checks, remove final_rating write, deadline enforcement"
```

---

### Task 8: Fix hrbp/actions.ts

Rewrite with:
- ``overrideRating``: cross-cycle guard (appraisal.cycle_id === cycleId), optimistic lock (``.eq('is_final', false)`` + check ``count === 0`` for concurrent override)
- ``lockCycle``: replace per-appraisal loop with single ``supabase.rpc('bulk_lock_appraisals', {...})`` call
- ``publishCycle``: guard ``cycle.status !== 'locked'`` before publishing

```bash
npx tsc --noEmit
git commit -m "fix: bulk lockCycle via RPC, publishCycle guard, optimistic lock on overrideRating"
```

---

### Task 9: Fix admin/actions.ts

- ``createCycle``: validate ``sme_multiplier`` via ``validateMultiplier``, return ``ActionResult``
- ``advanceCycleStatus``: atomic check-and-set with ``.eq('status', currentStatus)`` + ``count === 0`` concurrent error

```bash
npx tsc --noEmit
git commit -m "fix: atomic cycle status guard and SME multiplier validation"
```

---

### Task 10: Fix upload/actions.ts

Use ``parseCsv`` with required columns ``['zimyo_id', 'email', 'full_name']``. Validate emails. Batch insert new users in one call. Return ``ActionResult<UploadSummary>`` with ``{ added, updated, skipped, skippedReasons }``.

```bash
npx tsc --noEmit
git commit -m "fix: proper CSV parser, batch ops, upload summary"
```

---

### Task 11: Fix admin/users/actions.ts (Zimyo sync)

Replace per-employee manager update loop with single RPC call:
```typescript
await supabase.rpc('bulk_update_manager_links', {
  p_zimyo_ids: zimyoIds,    // string[]
  p_manager_ids: managerIds // uuid[]
})
```

```bash
npx tsc --noEmit
git commit -m "perf: replace manager update loop with bulk RPC in Zimyo sync"
```

---

## Layer 4 — UI / UX Improvements

### Task 12: Create SubmitButton component

**``src/components/submit-button.tsx``** — client component using ``useFormStatus``. Accept ``pendingLabel`` and ``formAction`` (typed as ``(formData: FormData) => void | Promise<void>``) in addition to all ``Button`` props.

```bash
npx tsc --noEmit
git commit -m "feat: add SubmitButton with useFormStatus and formAction support"
```

---

### Task 13: Fix kpis/page.tsx

Add: server-side ownership redirect, empty state "No KPIs set yet — add one below", SubmitButton with "Adding..." label, inline error display from action result.

```bash
git commit -m "fix: ownership redirect, empty state, loading button on kpis page"
```

---

### Task 14: Fix review/page.tsx + review-form.tsx

Server page: ownership redirect, cycleId validation against DB, parallel fetch (kpis + review + appraisal). Client ``ReviewForm`` component: ``useActionState(submitManagerRating, initial)``, rating select, comments textarea, error display, SubmitButton.

```bash
git commit -m "fix: ownership redirect, cycleId validation, useActionState on review page"
```

---

### Task 15: Fix calibration/page.tsx + override-form.tsx

Extract ``OverrideForm`` client component with ``useActionState(overrideRating, initial)``, cycle_id hidden field, justification input, error display (including concurrent override message). Update calibration page: typed interfaces, no ``any``, OverrideForm per row, lock/publish buttons conditional on cycle status.

```bash
git commit -m "fix: type safety, cycle_id guard, OverrideForm with concurrent override error display"
```

---

### Task 16: Fix employee/page.tsx + actions.ts + review-form.tsx

Both actions return ``ActionResult``. Enforce ``self_review_deadline``. Create ``SelfReviewForm`` client component with dual formAction (draft + submit), error display. Update page to use it.

```bash
git commit -m "feat: error display, loading states, deadline enforcement on employee self-review"
```

---

### Task 17: Fix admin/cycles/new/page.tsx

Create ``CycleForm`` client component with ``useActionState(createCycle, initial)``, all cycle fields, error display, SubmitButton "Creating...".

```bash
git commit -m "feat: error display and loading state on new cycle form"
```

---

### Task 18: Add manager/my-review/page.tsx

Shows current manager's own KPIs, self-assessment status, and payout result if cycle is published. Fetch latest non-draft cycle. Managers are also employees.

```bash
git commit -m "feat: add manager my-review page"
```

---

### Task 19: Fix hrbp/page.tsx

Group cycles into Active (non-published) and Published sections. Empty state if no cycles.

```bash
git commit -m "feat: group cycles into active/published sections on HRBP overview"
```

---

### Task 20: Fix admin/users/page.tsx

Add empty state "No users yet — upload a CSV or sync with Zimyo."

```bash
git commit -m "feat: add empty state to admin users page"
```

---

## Layer 5 — Code Quality

### Task 21: Shared AuditLogTable + paginated audit log pages

- Create ``src/components/audit-log-table.tsx`` — typed, shared table component
- Update both admin and HRBP audit log pages: replace ``.limit(200)`` with page-based pagination (25/page), use ``searchParams.page``, show prev/next links

```bash
npx tsc --noEmit
npx vitest run
git commit -m "refactor: shared AuditLogTable and paginated audit log pages (25/page)"
```

---

### Task 22: CSV upload summary UI

Convert upload page to client component using ``useActionState``. Show "N created, N updated, N skipped" summary with per-row skip reasons after upload.

```bash
npx tsc --noEmit
npx vitest run
git commit -m "feat: upload summary UI (created/updated/skipped)"
```

---

## Layer 6 — Missing Features

### Task 23: Employee history page

Read ``src/app/(dashboard)/employee/history/page.tsx``. Implement to show all published cycles where the employee has an appraisal — columns: cycle name, quarter/year, self-rating, manager rating, final rating, payout multiplier, payout amount. Sort descending.

```bash
npx tsc --noEmit
git commit -m "feat: implement employee history page"
```

---

### Task 24: Manager team overview — per-employee status badges

On ``/manager`` page, for each direct report show: name, KPI status (Set/Not set), self-review status (Submitted/Draft/Not started), manager review status (Submitted/Pending). Links to review and KPI pages.

```bash
npx tsc --noEmit
git commit -m "feat: per-employee review status badges on manager overview"
```

---

### Task 25: Deadline display on employee and manager pages

Show relevant deadline for the current phase. If deadline has passed, show warning badge "Deadline passed — contact your HRBP".

```bash
npx tsc --noEmit
git commit -m "feat: phase deadline display and overdue warning on employee and manager pages"
```

---

### Task 26: Notification sender wiring

Read ``supabase/functions/notification-sender/index.ts``. Implement or complete handlers for:
- ``cycle_published`` — email all active employees their result
- ``review_submitted`` — notify manager when employee submits self-review
- ``manager_review_submitted`` — notify HRBP when manager submits

Verify trigger is wired in migrations or via Supabase function hooks.

```bash
git commit -m "feat: wire notification-sender for cycle events"
```

---

## Final Verification

### Task 27: Full test run + smoke test

```bash
npx vitest run      # all tests must pass
npx tsc --noEmit    # 0 errors
npm run dev
```

**Smoke test:**
1. Manager accessing another manager's employee KPI page → redirect to /manager
2. Manager submitting rating in wrong phase → inline error
3. HRBP override without justification → inline error
4. HRBP overriding same appraisal in two tabs → second gets "already finalised" error
5. Admin creates cycle with sme_multiplier=10 → validation error
6. Audit log → pagination controls visible
7. CSV upload with bad emails → per-row skip summary
8. Employee history page → past results visible
9. Manager my-review page → own KPIs and review status visible

**When completely finished, run:**
```
openclaw system event --text "Done: PMS v2 implementation complete — 27 tasks, all tests passing" --mode now
```
