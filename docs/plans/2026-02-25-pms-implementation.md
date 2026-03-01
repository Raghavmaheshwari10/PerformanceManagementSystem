# PMS Audit Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 53 audit issues across security, UX, code quality, data integrity, and performance in a dependency-layered order.

**Architecture:** Layer 1 (schema) → Layer 2 (utilities) → Layer 3 (security + server actions) → Layer 4 (UI/UX) → Layer 5 (code quality). Each layer builds on the previous so changes never fight each other.

**Tech Stack:** Next.js 16.1.6 (App Router, Server Actions, `useActionState`), Supabase (PostgreSQL 17, RLS), Vitest, TypeScript, Tailwind v4, shadcn/ui.

---

## Layer 1 — Schema & Database

### Task 1: Add migration 00006 with constraints and is_final column

**Files:**
- Create: `supabase/migrations/00006_integrity_and_indexes.sql`

**Step 1: Write the migration**

```sql
-- supabase/migrations/00006_integrity_and_indexes.sql

-- 1. DB-level constraints on numeric inputs
ALTER TABLE kpis ADD CONSTRAINT kpis_weight_bounds CHECK (weight IS NULL OR (weight > 0 AND weight <= 100));
ALTER TABLE cycles ADD CONSTRAINT cycles_sme_multiplier_bounds CHECK (sme_multiplier IS NULL OR (sme_multiplier >= 0 AND sme_multiplier <= 5));

-- 2. is_final column on appraisals — set to true when HRBP finalises a rating
--    Prevents manager re-submission from overwriting the HRBP decision
ALTER TABLE appraisals ADD COLUMN is_final boolean NOT NULL DEFAULT false;

-- 3. Composite indexes (cycle_id, manager_id) on reviews — only (cycle_id, employee_id) existed
CREATE INDEX IF NOT EXISTS idx_reviews_cycle_manager ON reviews(cycle_id, manager_id);

-- (cycle_id, employee_id) indexes already exist on kpis, reviews, appraisals per migration 00002)

-- 4. KPI weight sum trigger — rejects insert/update that would push total > 100
CREATE OR REPLACE FUNCTION check_kpi_weight_sum()
RETURNS TRIGGER AS $$
DECLARE
  total numeric;
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

CREATE TRIGGER kpi_weight_sum_check
  BEFORE INSERT OR UPDATE ON kpis
  FOR EACH ROW EXECUTE FUNCTION check_kpi_weight_sum();
```

**Step 2: Apply the migration**

```bash
npx supabase db reset
```

Expected: All 6 migrations apply cleanly. Verify with:
```bash
npx supabase db diff --schema public
```
Expected: No pending diff (migration applied).

**Step 3: Smoke-test the constraint via SQL**

```bash
npx supabase db execute --sql "INSERT INTO kpis(cycle_id, employee_id, manager_id, title, weight) VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'test', 150);" 2>&1 | grep -i "check"
```
Expected: Error containing `kpis_weight_bounds`.

**Step 4: Commit**

```bash
git add supabase/migrations/00006_integrity_and_indexes.sql
git commit -m "feat: add db constraints, is_final column, and kpi weight trigger"
```

---

## Layer 2 — Shared Utilities

### Task 2: Add validation utilities with tests

**Files:**
- Create: `src/lib/validate.ts`
- Create: `src/lib/__tests__/validate.test.ts`

**Step 1: Write failing tests**

```typescript
// src/lib/__tests__/validate.test.ts
import { describe, it, expect } from 'vitest'
import { validateEmail, validateWeight, validateMultiplier } from '@/lib/validate'

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('alice@company.com')).toBe(true)
    expect(validateEmail('a.b+c@x.co.uk')).toBe(true)
  })
  it('rejects invalid emails', () => {
    expect(validateEmail('')).toBe(false)
    expect(validateEmail('notanemail')).toBe(false)
    expect(validateEmail('@nodomain')).toBe(false)
    expect(validateEmail('no@')).toBe(false)
  })
})

describe('validateWeight', () => {
  it('accepts values 1-100', () => {
    expect(validateWeight(1)).toBe(true)
    expect(validateWeight(50)).toBe(true)
    expect(validateWeight(100)).toBe(true)
  })
  it('rejects out-of-range values', () => {
    expect(validateWeight(0)).toBe(false)
    expect(validateWeight(-1)).toBe(false)
    expect(validateWeight(101)).toBe(false)
    expect(validateWeight(NaN)).toBe(false)
  })
})

describe('validateMultiplier', () => {
  it('accepts values 0-5', () => {
    expect(validateMultiplier(0)).toBe(true)
    expect(validateMultiplier(2.5)).toBe(true)
    expect(validateMultiplier(5)).toBe(true)
  })
  it('rejects out-of-range values', () => {
    expect(validateMultiplier(-0.1)).toBe(false)
    expect(validateMultiplier(5.1)).toBe(false)
    expect(validateMultiplier(NaN)).toBe(false)
  })
})
```

**Step 2: Run tests — verify they fail**

```bash
npx vitest run src/lib/__tests__/validate.test.ts
```
Expected: FAIL — `validateEmail` not found.

**Step 3: Write implementation**

```typescript
// src/lib/validate.ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(value: string): boolean {
  return EMAIL_RE.test(value)
}

export function validateWeight(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 100
}

export function validateMultiplier(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 5
}
```

**Step 4: Run tests — verify they pass**

```bash
npx vitest run src/lib/__tests__/validate.test.ts
```
Expected: All 3 describe blocks PASS.

**Step 5: Commit**

```bash
git add src/lib/validate.ts src/lib/__tests__/validate.test.ts
git commit -m "feat: add validation utilities with tests"
```

---

### Task 3: Add CSV utilities with tests

**Files:**
- Create: `src/lib/csv.ts`
- Create: `src/lib/__tests__/csv.test.ts`

**Step 1: Write failing tests**

```typescript
// src/lib/__tests__/csv.test.ts
import { describe, it, expect } from 'vitest'
import { parseCsv, escapeCsvField } from '@/lib/csv'

describe('parseCsv', () => {
  it('parses simple CSV with header', () => {
    const input = 'name,email\nAlice,alice@test.com\nBob,bob@test.com'
    const result = parseCsv(input)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ name: 'Alice', email: 'alice@test.com' })
    expect(result[1]).toEqual({ name: 'Bob', email: 'bob@test.com' })
  })

  it('handles quoted fields with commas', () => {
    const input = 'name,dept\n"Smith, John",Engineering'
    const result = parseCsv(input)
    expect(result[0].name).toBe('Smith, John')
  })

  it('skips empty rows', () => {
    const input = 'name,email\nAlice,alice@test.com\n\n'
    const result = parseCsv(input)
    expect(result).toHaveLength(1)
  })

  it('trims header names', () => {
    const input = ' name , email \nAlice,alice@test.com'
    const result = parseCsv(input)
    expect(result[0]).toHaveProperty('name')
    expect(result[0]).toHaveProperty('email')
  })

  it('throws if required columns are missing', () => {
    const input = 'name,dept\nAlice,Eng'
    expect(() => parseCsv(input, ['email'])).toThrow('Missing required column')
  })
})

describe('escapeCsvField', () => {
  it('returns plain string unchanged', () => {
    expect(escapeCsvField('hello')).toBe('hello')
  })

  it('wraps field containing comma in quotes', () => {
    expect(escapeCsvField('Smith, John')).toBe('"Smith, John"')
  })

  it('escapes embedded double-quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""')
  })

  it('wraps field containing newline in quotes', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
  })
})
```

**Step 2: Run tests — verify they fail**

```bash
npx vitest run src/lib/__tests__/csv.test.ts
```
Expected: FAIL — module not found.

**Step 3: Write implementation**

```typescript
// src/lib/csv.ts

export function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function parseCsv(
  text: string,
  requiredColumns: string[] = []
): Record<string, string>[] {
  const lines = text.trim().split('\n').filter(l => l.trim() !== '')
  if (lines.length === 0) return []

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().trim())

  for (const col of requiredColumns) {
    if (!headers.includes(col)) {
      throw new Error(`Missing required column: ${col}`)
    }
  }

  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i])
    if (values.every(v => v.trim() === '')) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? '').trim() })
    rows.push(row)
  }
  return rows
}

// RFC 4180 single-row parser
function parseRow(line: string): string[] {
  const fields: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      let field = ''
      i++ // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          field += '"'
          i += 2
        } else if (line[i] === '"') {
          i++ // skip closing quote
          break
        } else {
          field += line[i++]
        }
      }
      fields.push(field)
      if (line[i] === ',') i++
    } else {
      const end = line.indexOf(',', i)
      if (end === -1) {
        fields.push(line.slice(i))
        break
      } else {
        fields.push(line.slice(i, end))
        i = end + 1
      }
    }
  }
  return fields
}
```

**Step 4: Run tests — verify they pass**

```bash
npx vitest run src/lib/__tests__/csv.test.ts
```
Expected: All 9 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/csv.ts src/lib/__tests__/csv.test.ts
git commit -m "feat: add RFC 4180 CSV parser and escapeCsvField utility"
```

---

### Task 4: Update types.ts with ActionResult and is_final field

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Add ActionResult type and is_final to Appraisal**

In `src/lib/types.ts`, add after the last export:

```typescript
// After the existing AuditLog interface:

export type ActionResult<T = null> = { data: T; error: null } | { data: null; error: string }
```

And update the `Appraisal` interface — add `is_final` field after `locked_at`:

```typescript
  locked_at: string | null
  is_final: boolean         // ← add this line
  created_at: string
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add ActionResult type and is_final field to Appraisal"
```

---

### Task 5: Add requireManagerOwnership to auth.ts with test

**Files:**
- Modify: `src/lib/auth.ts`
- Create: `src/lib/__tests__/auth.test.ts`

**Step 1: Write failing test**

```typescript
// src/lib/__tests__/auth.test.ts
import { describe, it, expect, vi } from 'vitest'
import { checkManagerOwnership } from '@/lib/auth'

// checkManagerOwnership is a pure function that takes a supabase query result,
// so we test the logic without a real DB connection.
// The actual DB-calling wrapper (requireManagerOwnership) is integration-tested
// via the manager action tests.

describe('checkManagerOwnership', () => {
  it('returns true when employee belongs to manager', () => {
    expect(checkManagerOwnership({ id: 'emp-1', manager_id: 'mgr-1' }, 'mgr-1')).toBe(true)
  })

  it('returns false when employee belongs to different manager', () => {
    expect(checkManagerOwnership({ id: 'emp-1', manager_id: 'mgr-2' }, 'mgr-1')).toBe(false)
  })

  it('returns false when employee has no manager', () => {
    expect(checkManagerOwnership({ id: 'emp-1', manager_id: null }, 'mgr-1')).toBe(false)
  })

  it('returns false when user record is null', () => {
    expect(checkManagerOwnership(null, 'mgr-1')).toBe(false)
  })
})
```

**Step 2: Run test — verify it fails**

```bash
npx vitest run src/lib/__tests__/auth.test.ts
```
Expected: FAIL — `checkManagerOwnership` not exported.

**Step 3: Update auth.ts**

Add to the bottom of `src/lib/auth.ts`:

```typescript
// Pure ownership check — separated so it can be unit tested without DB
export function checkManagerOwnership(
  user: { id: string; manager_id: string | null } | null,
  managerId: string
): boolean {
  return user?.manager_id === managerId
}

// DB-backed ownership check used in server actions
export async function requireManagerOwnership(
  employeeId: string,
  managerId: string
): Promise<void> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('id, manager_id')
    .eq('id', employeeId)
    .eq('is_active', true)
    .single()

  if (!checkManagerOwnership(data, managerId)) {
    redirect('/unauthorized')
  }
}
```

**Step 4: Run test — verify it passes**

```bash
npx vitest run src/lib/__tests__/auth.test.ts
```
Expected: 4 tests PASS.

**Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/lib/auth.ts src/lib/__tests__/auth.test.ts
git commit -m "feat: add requireManagerOwnership and checkManagerOwnership to auth lib"
```

---

## Layer 3 — Security & Server Action Fixes

### Task 6: Fix payroll-csv.ts for CSV injection

**Files:**
- Modify: `src/lib/payroll-csv.ts`
- Modify: `src/lib/__tests__/payroll-csv.test.ts`

**Step 1: Update the test to cover injection case**

Add a new test to `src/lib/__tests__/payroll-csv.test.ts`:

```typescript
  it('escapes commas and quotes in string fields', () => {
    const data = [
      { zimyo_id: 'Z001', full_name: 'Smith, John', department: 'Eng', final_rating: 'EE', payout_multiplier: 1.1, payout_amount: 11000 },
    ]
    const csv = generatePayrollCsv(data)
    const lines = csv.split('\n')
    expect(lines[1]).toContain('"Smith, John"')
  })
```

**Step 2: Run test — verify it fails**

```bash
npx vitest run src/lib/__tests__/payroll-csv.test.ts
```
Expected: The new injection test FAILS (name with comma not quoted).

**Step 3: Update payroll-csv.ts to use escapeCsvField**

Replace `src/lib/payroll-csv.ts` with:

```typescript
import { escapeCsvField } from '@/lib/csv'

interface PayrollRow {
  zimyo_id: string
  full_name: string
  department: string
  final_rating: string
  payout_multiplier: number
  payout_amount: number
}

export function generatePayrollCsv(data: PayrollRow[]): string {
  const header = 'zimyo_employee_id,employee_name,department,final_rating,payout_multiplier,payout_amount'
  const rows = data.map(r =>
    [
      escapeCsvField(r.zimyo_id),
      escapeCsvField(r.full_name),
      escapeCsvField(r.department),
      escapeCsvField(r.final_rating),
      r.payout_multiplier,
      r.payout_amount,
    ].join(',')
  )
  return [header, ...rows].join('\n')
}
```

**Step 4: Run all payroll-csv tests — verify all pass**

```bash
npx vitest run src/lib/__tests__/payroll-csv.test.ts
```
Expected: All 3 tests PASS (the original 2 still pass since normal names don't need quoting).

**Step 5: Commit**

```bash
git add src/lib/payroll-csv.ts src/lib/__tests__/payroll-csv.test.ts
git commit -m "fix: escape CSV fields in payroll export to prevent injection"
```

---

### Task 7: Fix manager/actions.ts (IDOR + manager_rating only + weight validation)

**Files:**
- Modify: `src/app/(dashboard)/manager/actions.ts`

**Step 1: Rewrite manager/actions.ts**

Replace the entire file content with:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole, requireManagerOwnership } from '@/lib/auth'
import { validateWeight } from '@/lib/validate'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function addKpi(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireRole(['manager'])
  const supabase = await createClient()

  const employeeId = formData.get('employee_id') as string
  const cycleId = formData.get('cycle_id') as string
  const weight = Number(formData.get('weight'))

  await requireManagerOwnership(employeeId, user.id)

  if (weight && !validateWeight(weight)) {
    return { data: null, error: 'Weight must be between 1 and 100' }
  }

  const { error } = await supabase.from('kpis').insert({
    cycle_id: cycleId,
    employee_id: employeeId,
    manager_id: user.id,
    title: formData.get('title') as string,
    description: (formData.get('description') as string) || null,
    weight: weight || null,
  })

  if (error) return { data: null, error: error.message }
  revalidatePath(`/manager/${employeeId}/kpis`)
  return { data: null, error: null }
}

export async function deleteKpi(kpiId: string, employeeId: string): Promise<ActionResult> {
  const user = await requireRole(['manager'])
  await requireManagerOwnership(employeeId, user.id)
  const supabase = await createClient()
  const { error } = await supabase.from('kpis').delete().eq('id', kpiId)
  if (error) return { data: null, error: error.message }
  revalidatePath(`/manager/${employeeId}/kpis`)
  return { data: null, error: null }
}

export async function submitManagerRating(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireRole(['manager'])
  const supabase = await createClient()

  const cycleId = formData.get('cycle_id') as string
  const employeeId = formData.get('employee_id') as string
  const rating = formData.get('manager_rating') as string
  const comments = formData.get('manager_comments') as string

  await requireManagerOwnership(employeeId, user.id)

  // Only write manager_rating — NOT final_rating (set by HRBP at lock time)
  const { error } = await supabase.from('appraisals').upsert({
    cycle_id: cycleId,
    employee_id: employeeId,
    manager_id: user.id,
    manager_rating: rating,
    manager_comments: comments,
    manager_submitted_at: new Date().toISOString(),
  }, { onConflict: 'cycle_id,employee_id' })

  if (error) return { data: null, error: error.message }
  revalidatePath('/manager')
  return { data: null, error: null }
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/manager/actions.ts
git commit -m "fix: add IDOR ownership checks and remove final_rating from manager actions"
```

---

### Task 8: Fix hrbp/actions.ts (override guard + publishCycle state check + N+1 fix)

**Files:**
- Modify: `src/app/(dashboard)/hrbp/actions.ts`

**Step 1: Rewrite hrbp/actions.ts**

Replace the entire file:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { getPayoutMultiplier } from '@/lib/constants'
import type { RatingTier, ActionResult } from '@/lib/types'
import { revalidatePath } from 'next/cache'

export async function overrideRating(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireRole(['hrbp'])
  const supabase = await createClient()

  const appraisalId = formData.get('appraisal_id') as string
  const cycleId = formData.get('cycle_id') as string
  const newRating = formData.get('final_rating') as RatingTier
  const justification = formData.get('justification') as string

  if (!justification?.trim()) {
    return { data: null, error: 'Justification is required for rating overrides' }
  }

  const { data: appraisal } = await supabase
    .from('appraisals')
    .select('*, cycles(sme_multiplier)')
    .eq('id', appraisalId)
    .single()

  if (!appraisal) return { data: null, error: 'Appraisal not found' }

  // Guard: appraisal must belong to the cycle being edited
  if (appraisal.cycle_id !== cycleId) {
    return { data: null, error: 'Appraisal does not belong to this cycle' }
  }

  const smeMultiplier = (appraisal as { cycles?: { sme_multiplier?: number } }).cycles?.sme_multiplier ?? 0
  const multiplier = getPayoutMultiplier(newRating, smeMultiplier)

  const { data: employee } = await supabase
    .from('users').select('variable_pay').eq('id', appraisal.employee_id).single()

  const payoutAmount = (employee?.variable_pay ?? 0) * multiplier

  const { error } = await supabase.from('appraisals').update({
    final_rating: newRating,
    final_rating_set_by: user.id,
    payout_multiplier: multiplier,
    payout_amount: payoutAmount,
    is_final: true,
  }).eq('id', appraisalId)

  if (error) return { data: null, error: error.message }

  await supabase.from('audit_logs').insert({
    cycle_id: appraisal.cycle_id,
    changed_by: user.id,
    action: 'rating_override',
    entity_type: 'appraisal',
    entity_id: appraisalId,
    old_value: { final_rating: appraisal.final_rating },
    new_value: { final_rating: newRating },
    justification,
  })

  revalidatePath('/hrbp/calibration')
  return { data: null, error: null }
}

export async function lockCycle(cycleId: string): Promise<ActionResult> {
  const user = await requireRole(['hrbp'])
  const supabase = await createClient()

  const { data: cycle } = await supabase
    .from('cycles').select('sme_multiplier, status').eq('id', cycleId).single()

  if (cycle?.status !== 'calibrating') {
    return { data: null, error: 'Cycle must be in calibrating status to lock' }
  }

  const { data: appraisals } = await supabase
    .from('appraisals')
    .select('id, employee_id, final_rating, manager_rating, is_final')
    .eq('cycle_id', cycleId)

  if (!appraisals?.length) {
    return { data: null, error: 'No appraisals found for this cycle' }
  }

  // Batch-fetch all employees in one query (eliminates N+1)
  const employeeIds = appraisals.map(a => a.employee_id)
  const { data: employees } = await supabase
    .from('users')
    .select('id, variable_pay')
    .in('id', employeeIds)

  const empMap = new Map((employees ?? []).map(e => [e.id, e.variable_pay ?? 0]))
  const smeMultiplier = cycle?.sme_multiplier ?? 0

  // Batch all appraisal updates
  for (const a of appraisals) {
    // Skip if HRBP has already finalised this appraisal
    if (a.is_final) continue
    const rating = (a.final_rating ?? a.manager_rating) as RatingTier
    if (!rating) continue
    const multiplier = getPayoutMultiplier(rating, smeMultiplier)
    const variablePay = empMap.get(a.employee_id) ?? 0
    await supabase.from('appraisals').update({
      final_rating: rating,
      payout_multiplier: multiplier,
      payout_amount: variablePay * multiplier,
      locked_at: new Date().toISOString(),
    }).eq('id', a.id)
  }

  await supabase.from('cycles')
    .update({ status: 'locked', updated_at: new Date().toISOString() })
    .eq('id', cycleId)

  await supabase.from('audit_logs').insert({
    cycle_id: cycleId, changed_by: user.id, action: 'cycle_locked',
    entity_type: 'cycle', entity_id: cycleId, new_value: { status: 'locked' },
  })

  revalidatePath('/hrbp')
  return { data: null, error: null }
}

export async function publishCycle(cycleId: string): Promise<ActionResult> {
  const user = await requireRole(['hrbp'])
  const supabase = await createClient()

  // Guard: cycle must be locked before publishing
  const { data: cycle } = await supabase
    .from('cycles').select('status').eq('id', cycleId).single()

  if (cycle?.status !== 'locked') {
    return { data: null, error: 'Cycle must be locked before publishing' }
  }

  const { error } = await supabase.from('cycles').update({
    status: 'published',
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', cycleId)

  if (error) return { data: null, error: error.message }

  const { data: employees } = await supabase.from('users').select('id').eq('is_active', true)
  const notifications = (employees ?? []).map(e => ({
    recipient_id: e.id,
    type: 'cycle_published' as const,
    payload: { cycle_id: cycleId },
  }))
  if (notifications.length) await supabase.from('notifications').insert(notifications)

  await supabase.from('audit_logs').insert({
    cycle_id: cycleId, changed_by: user.id, action: 'cycle_published',
    entity_type: 'cycle', entity_id: cycleId, new_value: { status: 'published' },
  })

  revalidatePath('/hrbp')
  return { data: null, error: null }
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/hrbp/actions.ts
git commit -m "fix: add publishCycle guard, HRBP override cross-cycle guard, eliminate N+1 in lockCycle"
```

---

### Task 9: Fix admin/actions.ts (add error propagation)

**Files:**
- Modify: `src/app/(dashboard)/admin/actions.ts`

**Step 1: Update createCycle and advanceCycleStatus to return ActionResult**

Replace `src/app/(dashboard)/admin/actions.ts`:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { canTransition, getTransitionRequirements } from '@/lib/cycle-machine'
import { validateMultiplier } from '@/lib/validate'
import type { CycleStatus, ActionResult } from '@/lib/types'
import { revalidatePath } from 'next/cache'

export async function createCycle(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireRole(['admin', 'hrbp'])
  const supabase = await createClient()

  const smeMultiplier = Number(formData.get('sme_multiplier'))
  if (!validateMultiplier(smeMultiplier)) {
    return { data: null, error: 'SME multiplier must be between 0 and 5' }
  }

  const { error } = await supabase.from('cycles').insert({
    name: formData.get('name') as string,
    quarter: formData.get('quarter') as string,
    year: Number(formData.get('year')),
    sme_multiplier: smeMultiplier,
    kpi_setting_deadline: (formData.get('kpi_setting_deadline') as string) || null,
    self_review_deadline: (formData.get('self_review_deadline') as string) || null,
    manager_review_deadline: (formData.get('manager_review_deadline') as string) || null,
    calibration_deadline: (formData.get('calibration_deadline') as string) || null,
    created_by: user.id,
  })

  if (error) return { data: null, error: error.message }
  revalidatePath('/admin')
  return { data: null, error: null }
}

export async function advanceCycleStatus(
  cycleId: string,
  currentStatus: CycleStatus
): Promise<ActionResult> {
  const user = await requireRole(['admin', 'hrbp'])
  const supabase = await createClient()

  const nextMap: Record<string, CycleStatus> = {
    draft: 'kpi_setting',
    kpi_setting: 'self_review',
    self_review: 'manager_review',
    manager_review: 'calibrating',
    calibrating: 'locked',
    locked: 'published',
  }
  const nextStatus = nextMap[currentStatus]
  if (!nextStatus || !canTransition(currentStatus, nextStatus)) {
    return { data: null, error: `Cannot advance from ${currentStatus}` }
  }

  const req = getTransitionRequirements(currentStatus, nextStatus)
  if (!req?.allowedRoles.includes(user.role)) {
    return { data: null, error: 'Not authorized for this transition' }
  }

  // Atomic check-and-set: only update if status hasn't changed since page load
  const updateData: Record<string, unknown> = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  }
  if (nextStatus === 'published') {
    updateData.published_at = new Date().toISOString()
  }

  const { error, count } = await supabase
    .from('cycles')
    .update(updateData)
    .eq('id', cycleId)
    .eq('status', currentStatus) // guard: only update if still in expected status

  if (error) return { data: null, error: error.message }
  if (count === 0) return { data: null, error: 'Cycle status changed concurrently — please refresh' }

  await supabase.from('audit_logs').insert({
    cycle_id: cycleId,
    changed_by: user.id,
    action: 'cycle_status_change',
    entity_type: 'cycle',
    entity_id: cycleId,
    old_value: { status: currentStatus },
    new_value: { status: nextStatus },
  })

  revalidatePath('/admin')
  revalidatePath('/hrbp')
  return { data: null, error: null }
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/admin/actions.ts
git commit -m "fix: add atomic cycle status guard and SME multiplier validation"
```

---

### Task 10: Fix upload/actions.ts (CSV parser + batch ops + error summary)

**Files:**
- Modify: `src/app/(dashboard)/admin/users/upload/actions.ts`

**Step 1: Rewrite uploadUsersCsv to use parseCsv and batch ops**

```typescript
'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { parseCsv } from '@/lib/csv'
import { validateEmail } from '@/lib/validate'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

interface UploadSummary {
  added: number
  updated: number
  skipped: number
  skippedReasons: string[]
}

export async function uploadUsersCsv(
  _prevState: ActionResult<UploadSummary>,
  formData: FormData
): Promise<ActionResult<UploadSummary>> {
  const user = await requireRole(['admin'])
  const file = formData.get('file') as File
  if (!file) return { data: null, error: 'No file provided' }

  let rows: Record<string, string>[]
  try {
    const text = await file.text()
    rows = parseCsv(text, ['zimyo_id', 'email', 'full_name'])
  } catch (e) {
    return { data: null, error: (e as Error).message }
  }

  const supabase = await createServiceClient()
  let added = 0, updated = 0, skipped = 0
  const skippedReasons: string[] = []

  // Validate all rows first
  const validRows: Record<string, string>[] = []
  for (const row of rows) {
    if (!row.zimyo_id?.trim()) {
      skipped++; skippedReasons.push(`Row skipped: missing zimyo_id`); continue
    }
    if (!validateEmail(row.email ?? '')) {
      skipped++; skippedReasons.push(`Row skipped: invalid email "${row.email}"`); continue
    }
    if (!row.full_name?.trim()) {
      skipped++; skippedReasons.push(`Row skipped: missing full_name for ${row.zimyo_id}`); continue
    }
    validRows.push(row)
  }

  // Batch-fetch existing users by zimyo_id
  const zimyoIds = validRows.map(r => r.zimyo_id)
  const { data: existing } = await supabase
    .from('users').select('id, zimyo_id, email')
    .in('zimyo_id', zimyoIds)

  const existingMap = new Map((existing ?? []).map(e => [e.zimyo_id, e.id]))
  const emailToId = new Map<string, string>()

  const toInsert: object[] = []
  const toUpdate: { zimyo_id: string; data: object }[] = []

  for (const row of validRows) {
    const userData = {
      zimyo_id: row.zimyo_id,
      email: row.email,
      full_name: row.full_name,
      department: row.department || null,
      designation: row.designation || null,
      synced_at: new Date().toISOString(),
    }
    if (existingMap.has(row.zimyo_id)) {
      toUpdate.push({ zimyo_id: row.zimyo_id, data: userData })
      emailToId.set(row.email, existingMap.get(row.zimyo_id)!)
    } else {
      toInsert.push(userData)
    }
  }

  // Batch insert new users
  if (toInsert.length > 0) {
    const { data: inserted, error } = await supabase
      .from('users').insert(toInsert).select('id, email')
    if (error) return { data: null, error: `Batch insert failed: ${error.message}` }
    for (const u of inserted ?? []) emailToId.set(u.email, u.id)
    added = toInsert.length
  }

  // Update existing users one-by-one (upsert by zimyo_id — Supabase upsert needs unique key)
  for (const { zimyo_id, data } of toUpdate) {
    await supabase.from('users').update(data).eq('zimyo_id', zimyo_id)
    updated++
  }

  // Batch manager links using collected emailToId map
  const managerUpdates = validRows.filter(r => r.manager_email && emailToId.has(r.manager_email))
  for (const row of managerUpdates) {
    const managerId = emailToId.get(row.manager_email)
    if (managerId) {
      await supabase.from('users').update({ manager_id: managerId }).eq('zimyo_id', row.zimyo_id)
    }
  }

  await supabase.from('audit_logs').insert({
    changed_by: user.id,
    action: 'csv_upload',
    entity_type: 'user',
    new_value: { added, updated, skipped },
  })

  revalidatePath('/admin/users')
  return { data: { added, updated, skipped, skippedReasons }, error: null }
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/admin/users/upload/actions.ts
git commit -m "fix: use proper CSV parser, validate emails, batch ops, return upload summary"
```

---

### Task 11: Fix admin/users/actions.ts (Zimyo sync N+1 for manager links)

**Files:**
- Modify: `src/app/(dashboard)/admin/users/actions.ts`

**Step 1: Replace the second manager-link loop with a bulk update**

Replace the manager-link loop (lines 36-43 in original) with:

```typescript
  // Bulk-update manager_id using a single upsert per row
  // (Supabase doesn't support SET col = CASE .. so we do it via filter, not a full N+1)
  // Collect all (zimyo_id, manager_id) pairs first then batch
  const managerUpdates: Array<{ zimyo_id: string; manager_id: string }> = []
  for (const emp of zimyoEmployees) {
    if (emp.reporting_manager_email) {
      const managerId = emailToId.get(emp.reporting_manager_email)
      if (managerId) {
        managerUpdates.push({ zimyo_id: emp.employee_id, manager_id: managerId })
      }
    }
  }

  // Process in batches of 100 to avoid query size limits
  for (let i = 0; i < managerUpdates.length; i += 100) {
    const batch = managerUpdates.slice(i, i + 100)
    await Promise.all(
      batch.map(({ zimyo_id, manager_id }) =>
        supabase.from('users').update({ manager_id }).eq('zimyo_id', zimyo_id)
      )
    )
  }
```

The full replacement for `src/app/(dashboard)/admin/users/actions.ts` — replace the second `for` loop section (lines 36-43 in the original):

Open `src/app/(dashboard)/admin/users/actions.ts` and replace:

```typescript
  for (const emp of zimyoEmployees) {
    if (emp.reporting_manager_email) {
      const managerId = emailToId.get(emp.reporting_manager_email)
      if (managerId) {
        await supabase.from('users').update({ manager_id: managerId }).eq('zimyo_id', emp.employee_id)
      }
    }
  }
```

With:

```typescript
  // Batch manager-link updates (parallelised in groups of 100)
  const managerUpdates: Array<{ zimyo_id: string; manager_id: string }> = []
  for (const emp of zimyoEmployees) {
    if (emp.reporting_manager_email) {
      const managerId = emailToId.get(emp.reporting_manager_email)
      if (managerId) managerUpdates.push({ zimyo_id: emp.employee_id, manager_id: managerId })
    }
  }
  for (let i = 0; i < managerUpdates.length; i += 100) {
    await Promise.all(
      managerUpdates.slice(i, i + 100).map(({ zimyo_id, manager_id }) =>
        supabase.from('users').update({ manager_id }).eq('zimyo_id', zimyo_id)
      )
    )
  }
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/admin/users/actions.ts
git commit -m "perf: parallelize manager-link updates in Zimyo sync"
```

---

## Layer 4 — UI / UX Improvements

### Task 12: Create SubmitButton client component

This client component is reused across all forms that need loading state.

**Files:**
- Create: `src/components/submit-button.tsx`

**Step 1: Write the component**

```tsx
// src/components/submit-button.tsx
'use client'

import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import type { ComponentProps } from 'react'

type Props = ComponentProps<typeof Button> & {
  pendingLabel?: string
}

export function SubmitButton({ children, pendingLabel, disabled, ...props }: Props) {
  const { pending } = useFormStatus()
  return (
    <Button {...props} type="submit" disabled={disabled || pending}>
      {pending ? (pendingLabel ?? 'Saving...') : children}
    </Button>
  )
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/submit-button.tsx
git commit -m "feat: add SubmitButton client component with loading state via useFormStatus"
```

---

### Task 13: Fix manager/[employeeId]/kpis/page.tsx

Add: ownership redirect, empty state, SubmitButton, action error display.

**Files:**
- Modify: `src/app/(dashboard)/manager/[employeeId]/kpis/page.tsx`

**Step 1: Rewrite the kpis page**

```tsx
import { createClient } from '@/lib/supabase/server'
import { requireRole, requireManagerOwnership } from '@/lib/auth'
import { addKpi, deleteKpi } from '../../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/submit-button'
import type { Kpi, User } from '@/lib/types'
import { redirect } from 'next/navigation'

export default async function KpiSettingPage({
  params, searchParams,
}: {
  params: Promise<{ employeeId: string }>
  searchParams: Promise<{ cycle?: string }>
}) {
  const user = await requireRole(['manager'])
  const { employeeId } = await params
  const { cycle: cycleId } = await searchParams
  const supabase = await createClient()

  // Verify this employee belongs to the current manager
  const { data: employee } = await supabase
    .from('users').select('id, full_name, manager_id').eq('id', employeeId).single()

  if (!employee || employee.manager_id !== user.id) redirect('/manager')

  if (!cycleId) redirect('/manager')

  const { data: kpis } = await supabase
    .from('kpis').select('*').eq('cycle_id', cycleId).eq('employee_id', employeeId)

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">KPIs for {(employee as User).full_name}</h1>

      <div className="space-y-2">
        {(kpis as Kpi[] ?? []).length === 0 && (
          <p className="text-muted-foreground text-sm">No KPIs set yet — add one below.</p>
        )}
        {(kpis as Kpi[] ?? []).map(kpi => (
          <div key={kpi.id} className="flex items-center justify-between rounded border p-3">
            <div>
              <p className="font-medium">{kpi.title}</p>
              <p className="text-sm text-muted-foreground">Weight: {kpi.weight}%</p>
            </div>
            <form action={deleteKpi.bind(null, kpi.id, employeeId)}>
              <Button variant="ghost" size="sm" type="submit">Remove</Button>
            </form>
          </div>
        ))}
      </div>

      <form action={addKpi} className="space-y-4 rounded border p-4">
        <h2 className="text-lg font-semibold">Add KPI</h2>
        <input type="hidden" name="cycle_id" value={cycleId} />
        <input type="hidden" name="employee_id" value={employeeId} />
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weight">Weight (%)</Label>
          <Input id="weight" name="weight" type="number" min="1" max="100" />
        </div>
        <SubmitButton pendingLabel="Adding...">Add KPI</SubmitButton>
      </form>
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add "src/app/(dashboard)/manager/[employeeId]/kpis/page.tsx"
git commit -m "fix: add ownership redirect, empty state, and loading button to kpis page"
```

---

### Task 14: Fix manager/[employeeId]/review/page.tsx

Add: ownership redirect, cycleId validation, SubmitButton, error display via useActionState.

**Files:**
- Modify: `src/app/(dashboard)/manager/[employeeId]/review/page.tsx`
- Create: `src/app/(dashboard)/manager/[employeeId]/review/review-form.tsx`

**Step 1: Create the review-form.tsx client component**

```tsx
// src/app/(dashboard)/manager/[employeeId]/review/review-form.tsx
'use client'

import { useActionState } from 'react'
import { submitManagerRating } from '../../actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/submit-button'
import { RATING_TIERS } from '@/lib/constants'
import type { ActionResult } from '@/lib/types'

interface Props {
  cycleId: string
  employeeId: string
}

const initialState: ActionResult = { data: null, error: null }

export function ReviewForm({ cycleId, employeeId }: Props) {
  const [state, formAction] = useActionState(submitManagerRating, initialState)

  return (
    <form action={formAction} className="space-y-4 rounded border p-4">
      <h2 className="text-lg font-semibold">Your Rating</h2>
      <input type="hidden" name="cycle_id" value={cycleId} />
      <input type="hidden" name="employee_id" value={employeeId} />
      <div className="space-y-2">
        <Label htmlFor="manager_rating">Rating</Label>
        <select id="manager_rating" name="manager_rating" className="w-full rounded border p-2" required>
          <option value="">Select...</option>
          {RATING_TIERS.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="manager_comments">Comments</Label>
        <Textarea id="manager_comments" name="manager_comments" rows={5} required />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Submitting...">Submit Rating</SubmitButton>
    </form>
  )
}
```

**Step 2: Update review/page.tsx to use ReviewForm and add ownership + cycle validation**

```tsx
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { ReviewForm } from './review-form'
import { RATING_TIERS } from '@/lib/constants'
import type { User, Kpi, Review, Appraisal } from '@/lib/types'
import { redirect } from 'next/navigation'

export default async function ManagerReviewPage({
  params, searchParams,
}: {
  params: Promise<{ employeeId: string }>
  searchParams: Promise<{ cycle?: string }>
}) {
  const user = await requireRole(['manager'])
  const { employeeId } = await params
  const { cycle: cycleId } = await searchParams
  const supabase = await createClient()

  if (!cycleId) redirect('/manager')

  // Validate employee ownership
  const { data: employee } = await supabase
    .from('users').select('id, full_name, manager_id').eq('id', employeeId).single()

  if (!employee || employee.manager_id !== user.id) redirect('/manager')

  // Validate cycleId exists
  const { data: cycle } = await supabase
    .from('cycles').select('id').eq('id', cycleId).single()

  if (!cycle) redirect('/manager')

  const [kpiRes, reviewRes, appraisalRes] = await Promise.all([
    supabase.from('kpis').select('*').eq('cycle_id', cycleId).eq('employee_id', employeeId),
    supabase.from('reviews').select('*').eq('cycle_id', cycleId).eq('employee_id', employeeId).single(),
    supabase.from('appraisals').select('*').eq('cycle_id', cycleId).eq('employee_id', employeeId).single(),
  ])

  const kpis = kpiRes.data as Kpi[] ?? []
  const review = reviewRes.data as Review | null
  const appraisal = appraisalRes.data as Appraisal | null

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Review: {(employee as User).full_name}</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">KPIs</h2>
        {kpis.length === 0 && <p className="text-muted-foreground text-sm">No KPIs set for this employee.</p>}
        {kpis.map(kpi => (
          <div key={kpi.id} className="rounded border p-3">
            <p className="font-medium">{kpi.title} ({kpi.weight}%)</p>
            {kpi.description && <p className="text-sm text-muted-foreground">{kpi.description}</p>}
          </div>
        ))}
      </section>

      {review && (
        <section className="rounded border bg-muted/30 p-4 space-y-2">
          <h2 className="text-lg font-semibold">Employee Self Assessment</h2>
          <p>Rating: <span className="font-bold">{review.self_rating}</span></p>
          <p className="whitespace-pre-wrap">{review.self_comments}</p>
        </section>
      )}

      {!appraisal?.manager_submitted_at && (
        <ReviewForm cycleId={cycleId} employeeId={employeeId} />
      )}

      {appraisal?.manager_submitted_at && (
        <p className="text-green-600 font-medium">Rating submitted: {appraisal.manager_rating}</p>
      )}
    </div>
  )
}
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add "src/app/(dashboard)/manager/[employeeId]/review/"
git commit -m "fix: add ownership redirect, cycleId validation, and useActionState to review page"
```

---

### Task 15: Fix hrbp/calibration/page.tsx (type safety + loading + cycle_id hidden field)

The `overrideRating` action now requires `cycle_id` in formData. Update the calibration form.

**Files:**
- Modify: `src/app/(dashboard)/hrbp/calibration/page.tsx`

**Step 1: Update the calibration page**

Replace the override form `action={overrideRating}` section and fix `any` types. Replace the file:

```tsx
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { BellCurveChart } from '@/components/bell-curve-chart'
import { lockCycle, publishCycle } from '../actions'
import { OverrideForm } from './override-form'
import { Button } from '@/components/ui/button'
import type { RatingTier, Appraisal, Cycle } from '@/lib/types'

interface AppraisalWithUser extends Appraisal {
  users: { full_name: string; department: string | null } | null
}

export default async function CalibrationPage({ searchParams }: { searchParams: Promise<{ cycle?: string }> }) {
  await requireRole(['hrbp'])
  const { cycle: cycleId } = await searchParams
  const supabase = await createClient()

  if (!cycleId) return <p>Select a cycle from the overview page.</p>

  const { data: cycle } = await supabase.from('cycles').select('*').eq('id', cycleId).single()
  const { data: appraisals } = await supabase
    .from('appraisals')
    .select('*, users!appraisals_employee_id_fkey(full_name, department)')
    .eq('cycle_id', cycleId)

  const typedAppraisals = (appraisals ?? []) as AppraisalWithUser[]
  const distribution: Record<RatingTier, number> = { FEE: 0, EE: 0, ME: 0, SME: 0, BE: 0 }
  for (const a of typedAppraisals) {
    const rating = a.final_rating ?? a.manager_rating
    if (rating) distribution[rating]++
  }

  const typedCycle = cycle as Cycle | null
  const isCalibrating = typedCycle?.status === 'calibrating'
  const isLocked = typedCycle?.status === 'locked'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Calibration — {typedCycle?.name}</h1>

      <BellCurveChart distribution={distribution} total={typedAppraisals.length} />

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left">Employee</th>
              <th className="p-3 text-left">Department</th>
              <th className="p-3 text-left">Manager Rating</th>
              <th className="p-3 text-left">Final Rating</th>
              {isCalibrating && <th className="p-3 text-left">Override</th>}
            </tr>
          </thead>
          <tbody>
            {typedAppraisals.map(a => (
              <tr key={a.id} className="border-b">
                <td className="p-3">{a.users?.full_name}</td>
                <td className="p-3">{a.users?.department}</td>
                <td className="p-3">{a.manager_rating}</td>
                <td className="p-3 font-medium">{a.final_rating ?? a.manager_rating}</td>
                {isCalibrating && (
                  <td className="p-3">
                    <OverrideForm appraisalId={a.id} cycleId={cycleId} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3">
        {isCalibrating && (
          <form action={lockCycle.bind(null, cycleId!)}>
            <Button variant="destructive" type="submit">Lock Cycle</Button>
          </form>
        )}
        {isLocked && (
          <form action={publishCycle.bind(null, cycleId!)}>
            <Button type="submit">Publish Cycle</Button>
          </form>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Create override-form.tsx client component**

```tsx
// src/app/(dashboard)/hrbp/calibration/override-form.tsx
'use client'

import { useActionState } from 'react'
import { overrideRating } from '../actions'
import { Input } from '@/components/ui/input'
import { SubmitButton } from '@/components/submit-button'
import { RATING_TIERS } from '@/lib/constants'
import type { ActionResult } from '@/lib/types'

const initialState: ActionResult = { data: null, error: null }

export function OverrideForm({ appraisalId, cycleId }: { appraisalId: string; cycleId: string }) {
  const [state, formAction] = useActionState(overrideRating, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input type="hidden" name="appraisal_id" value={appraisalId} />
        <input type="hidden" name="cycle_id" value={cycleId} />
        <select name="final_rating" className="rounded border px-2 py-1 text-sm">
          {RATING_TIERS.map(t => <option key={t.code} value={t.code}>{t.code}</option>)}
        </select>
        <Input name="justification" placeholder="Justification" className="text-sm" required />
        <SubmitButton size="sm" pendingLabel="...">Save</SubmitButton>
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  )
}
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add "src/app/(dashboard)/hrbp/calibration/"
git commit -m "fix: add type safety, cycle_id guard, and loading state to calibration page"
```

---

### Task 16: Fix employee/page.tsx + actions.ts (useActionState for error display)

**Files:**
- Modify: `src/app/(dashboard)/employee/actions.ts`
- Create: `src/app/(dashboard)/employee/review-form.tsx`
- Modify: `src/app/(dashboard)/employee/page.tsx`

**Step 1: Update employee/actions.ts signatures**

Replace both actions to return ActionResult:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function submitSelfReview(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireRole(['employee'])
  const supabase = await createClient()

  const { error } = await supabase.from('reviews').upsert({
    cycle_id: formData.get('cycle_id') as string,
    employee_id: user.id,
    self_rating: formData.get('self_rating') as string,
    self_comments: formData.get('self_comments') as string,
    status: 'submitted',
    submitted_at: new Date().toISOString(),
  }, { onConflict: 'cycle_id,employee_id' })

  if (error) return { data: null, error: error.message }
  revalidatePath('/employee')
  return { data: null, error: null }
}

export async function saveDraftReview(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireRole(['employee'])
  const supabase = await createClient()

  const { error } = await supabase.from('reviews').upsert({
    cycle_id: formData.get('cycle_id') as string,
    employee_id: user.id,
    self_rating: (formData.get('self_rating') as string) || null,
    self_comments: formData.get('self_comments') as string,
    status: 'draft',
  }, { onConflict: 'cycle_id,employee_id' })

  if (error) return { data: null, error: error.message }
  revalidatePath('/employee')
  return { data: null, error: null }
}
```

**Step 2: Create employee/review-form.tsx**

```tsx
// src/app/(dashboard)/employee/review-form.tsx
'use client'

import { useActionState } from 'react'
import { submitSelfReview, saveDraftReview } from './actions'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/submit-button'
import { RATING_TIERS } from '@/lib/constants'
import type { ActionResult, Review } from '@/lib/types'

const initial: ActionResult = { data: null, error: null }

export function SelfReviewForm({ cycleId, review }: { cycleId: string; review: Review | null }) {
  const [submitState, submitAction] = useActionState(submitSelfReview, initial)
  const [draftState, draftAction] = useActionState(saveDraftReview, initial)
  const errorMsg = submitState.error ?? draftState.error

  return (
    <section className="space-y-4 rounded border p-4">
      <h2 className="text-lg font-semibold">Self Assessment</h2>
      <form className="space-y-4">
        <input type="hidden" name="cycle_id" value={cycleId} />
        <div className="space-y-2">
          <Label htmlFor="self_rating">Self Rating</Label>
          <select id="self_rating" name="self_rating" className="w-full rounded border p-2"
            defaultValue={review?.self_rating ?? ''}>
            <option value="">Select...</option>
            {RATING_TIERS.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="self_comments">Comments</Label>
          <Textarea id="self_comments" name="self_comments" rows={5}
            defaultValue={review?.self_comments ?? ''} required />
        </div>
        {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
        <div className="flex gap-2">
          <SubmitButton formAction={draftAction} variant="outline" pendingLabel="Saving...">
            Save Draft
          </SubmitButton>
          <SubmitButton formAction={submitAction} pendingLabel="Submitting...">
            Submit
          </SubmitButton>
        </div>
      </form>
    </section>
  )
}
```

**Step 3: Update employee/page.tsx to use SelfReviewForm**

Replace the `isSelfReview` form section in `employee/page.tsx`:

```tsx
      {isSelfReview && review?.status !== 'submitted' && (
        <SelfReviewForm cycleId={cycle.id} review={review} />
      )}
```

And add the import at the top:

```tsx
import { SelfReviewForm } from './review-form'
```

Remove the old imports of `submitSelfReview`, `saveDraftReview`, `Button`, and the inline form.

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add "src/app/(dashboard)/employee/"
git commit -m "feat: add error display and loading states to employee self-review form"
```

---

### Task 17: Fix admin/cycles/new/page.tsx (error display)

**Files:**
- Create: `src/app/(dashboard)/admin/cycles/new/cycle-form.tsx`
- Modify: `src/app/(dashboard)/admin/cycles/new/page.tsx`

**Step 1: Create cycle-form.tsx client component**

```tsx
// src/app/(dashboard)/admin/cycles/new/cycle-form.tsx
'use client'

import { useActionState } from 'react'
import { createCycle } from '../../actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/submit-button'
import type { ActionResult } from '@/lib/types'

const initial: ActionResult = { data: null, error: null }

export function CycleForm() {
  const [state, formAction] = useActionState(createCycle, initial)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Cycle Name</Label>
        <Input id="name" name="name" placeholder="Q1 2026" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quarter">Quarter</Label>
          <Input id="quarter" name="quarter" placeholder="Q1" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="year">Year</Label>
          <Input id="year" name="year" type="number" defaultValue={2026} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="sme_multiplier">SME Payout Multiplier (0–5)</Label>
        <Input id="sme_multiplier" name="sme_multiplier" type="number" step="0.01"
          min="0" max="5" placeholder="0.50" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="kpi_setting_deadline">KPI Setting Deadline</Label>
          <Input id="kpi_setting_deadline" name="kpi_setting_deadline" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="self_review_deadline">Self Review Deadline</Label>
          <Input id="self_review_deadline" name="self_review_deadline" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manager_review_deadline">Manager Review Deadline</Label>
          <Input id="manager_review_deadline" name="manager_review_deadline" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="calibration_deadline">Calibration Deadline</Label>
          <Input id="calibration_deadline" name="calibration_deadline" type="date" />
        </div>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Creating...">Create Cycle</SubmitButton>
    </form>
  )
}
```

**Step 2: Update new/page.tsx to use CycleForm**

```tsx
import { requireRole } from '@/lib/auth'
import { CycleForm } from './cycle-form'

export default async function NewCyclePage() {
  await requireRole(['admin', 'hrbp'])
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Create New Cycle</h1>
      <CycleForm />
    </div>
  )
}
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add "src/app/(dashboard)/admin/cycles/new/"
git commit -m "feat: add error display and loading state to new cycle form"
```

---

### Task 18: Add manager/my-review/page.tsx

**Files:**
- Create: `src/app/(dashboard)/manager/my-review/page.tsx`

**Step 1: Write the page**

```tsx
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { CycleStatusBadge } from '@/components/cycle-status-badge'
import type { Cycle, Kpi, Review, Appraisal } from '@/lib/types'

export default async function ManagerMyReviewPage() {
  const user = await requireRole(['manager'])
  const supabase = await createClient()

  // Managers are also employees — show their most recent non-draft cycle
  const { data: cycles } = await supabase
    .from('cycles').select('*')
    .neq('status', 'draft')
    .order('created_at', { ascending: false }).limit(1)

  const cycle = (cycles as Cycle[])?.[0]

  if (!cycle) return <p className="text-muted-foreground">No active review cycle.</p>

  const [kpiRes, reviewRes, appraisalRes] = await Promise.all([
    supabase.from('kpis').select('*').eq('cycle_id', cycle.id).eq('employee_id', user.id),
    supabase.from('reviews').select('*').eq('cycle_id', cycle.id).eq('employee_id', user.id).single(),
    supabase.from('appraisals').select('*').eq('cycle_id', cycle.id).eq('employee_id', user.id).single(),
  ])

  const kpis = kpiRes.data as Kpi[] ?? []
  const review = reviewRes.data as Review | null
  const appraisal = appraisalRes.data as Appraisal | null

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">My Review — {cycle.name}</h1>
        <CycleStatusBadge status={cycle.status} />
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">My KPIs</h2>
        {kpis.length === 0 && <p className="text-muted-foreground">No KPIs assigned yet.</p>}
        {kpis.map(kpi => (
          <div key={kpi.id} className="rounded border p-3">
            <p className="font-medium">{kpi.title}</p>
            {kpi.description && <p className="text-sm text-muted-foreground">{kpi.description}</p>}
            <p className="text-sm">Weight: {kpi.weight}%</p>
          </div>
        ))}
      </section>

      {review && (
        <section className="rounded border bg-muted/30 p-4 space-y-2">
          <h2 className="text-lg font-semibold">My Self Assessment</h2>
          <p>Status: <span className="font-medium capitalize">{review.status}</span></p>
          {review.self_rating && <p>Rating: <span className="font-bold">{review.self_rating}</span></p>}
          {review.self_comments && <p className="whitespace-pre-wrap">{review.self_comments}</p>}
        </section>
      )}

      {cycle.status === 'published' && appraisal && (
        <section className="rounded border bg-muted/30 p-4 space-y-2">
          <h2 className="text-lg font-semibold">Final Result</h2>
          <p>Final Rating: <span className="font-bold">{appraisal.final_rating}</span></p>
          <p>Payout Multiplier: <span className="font-bold">
            {appraisal.payout_multiplier ? `${(appraisal.payout_multiplier * 100).toFixed(0)}%` : 'N/A'}
          </span></p>
        </section>
      )}
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add "src/app/(dashboard)/manager/my-review/page.tsx"
git commit -m "feat: add manager my-review page (managers are also employees)"
```

---

### Task 19: Fix hrbp/page.tsx — group cycles (active first, published below)

**Files:**
- Modify: `src/app/(dashboard)/hrbp/page.tsx`

**Step 1: Update the page to group cycles**

```tsx
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { CycleStatusBadge } from '@/components/cycle-status-badge'
import Link from 'next/link'
import type { Cycle } from '@/lib/types'

export default async function HrbpPage() {
  await requireRole(['hrbp'])
  const supabase = await createClient()
  const { data: cycles } = await supabase
    .from('cycles').select('*').order('created_at', { ascending: false })

  const allCycles = cycles as Cycle[] ?? []
  const activeCycles = allCycles.filter(c => c.status !== 'published')
  const publishedCycles = allCycles.filter(c => c.status === 'published')

  const CycleCard = ({ cycle }: { cycle: Cycle }) => (
    <div className="flex items-center justify-between rounded border p-4">
      <div>
        <p className="font-medium">{cycle.name}</p>
        <CycleStatusBadge status={cycle.status} />
      </div>
      {['calibrating', 'locked'].includes(cycle.status) && (
        <Link href={`/hrbp/calibration?cycle=${cycle.id}`} className="text-blue-600 hover:underline">
          Calibrate
        </Link>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Review Cycles</h1>

      {activeCycles.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Active</h2>
          <div className="grid gap-3">
            {activeCycles.map(cycle => <CycleCard key={cycle.id} cycle={cycle} />)}
          </div>
        </section>
      )}

      {publishedCycles.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Published</h2>
          <div className="grid gap-3">
            {publishedCycles.map(cycle => <CycleCard key={cycle.id} cycle={cycle} />)}
          </div>
        </section>
      )}

      {allCycles.length === 0 && (
        <p className="text-muted-foreground">No cycles yet.</p>
      )}
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add "src/app/(dashboard)/hrbp/page.tsx"
git commit -m "feat: group cycles into active/published sections on HRBP overview"
```

---

## Layer 5 — Code Quality

### Task 20: Create shared AuditLogTable component + paginated audit log pages

**Files:**
- Create: `src/components/audit-log-table.tsx`
- Modify: `src/app/(dashboard)/admin/audit-log/page.tsx`
- Modify: `src/app/(dashboard)/hrbp/audit-log/page.tsx`

**Step 1: Create the shared AuditLogTable component**

```tsx
// src/components/audit-log-table.tsx
import type { AuditLog } from '@/lib/types'

interface AuditLogWithUser extends Omit<AuditLog, 'changed_by'> {
  users: { full_name: string } | null
}

interface Props {
  logs: AuditLogWithUser[]
}

export function AuditLogTable({ logs }: Props) {
  if (logs.length === 0) {
    return <p className="text-muted-foreground text-sm py-4 text-center">No audit log entries.</p>
  }

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="p-3 text-left">Timestamp</th>
            <th className="p-3 text-left">User</th>
            <th className="p-3 text-left">Action</th>
            <th className="p-3 text-left">Entity</th>
            <th className="p-3 text-left">Justification</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id} className="border-b">
              <td className="p-3 text-xs">{new Date(log.created_at).toLocaleString()}</td>
              <td className="p-3">{log.users?.full_name ?? 'System'}</td>
              <td className="p-3 font-mono text-xs">{log.action}</td>
              <td className="p-3 text-xs">{log.entity_type}</td>
              <td className="p-3 text-xs">{log.justification ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

**Step 2: Update admin/audit-log/page.tsx with pagination**

```tsx
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { AuditLogTable } from '@/components/audit-log-table'
import Link from 'next/link'

const PAGE_SIZE = 25

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  await requireRole(['admin'])
  const supabase = await createClient()
  const { page: pageStr } = await searchParams
  const page = Math.max(1, Number(pageStr) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data: logs, count } = await supabase
    .from('audit_logs')
    .select('*, users!audit_logs_changed_by_fkey(full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit Log</h1>
      <AuditLogTable logs={logs ?? []} />
      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          {page > 1 && (
            <Link href={`?page=${page - 1}`} className="rounded border px-3 py-1 hover:bg-muted">
              Previous
            </Link>
          )}
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`?page=${page + 1}`} className="rounded border px-3 py-1 hover:bg-muted">
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 3: Update hrbp/audit-log/page.tsx with pagination**

```tsx
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { AuditLogTable } from '@/components/audit-log-table'
import Link from 'next/link'

const PAGE_SIZE = 25

export default async function HrbpAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  await requireRole(['hrbp'])
  const supabase = await createClient()
  const { page: pageStr } = await searchParams
  const page = Math.max(1, Number(pageStr) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data: logs, count } = await supabase
    .from('audit_logs')
    .select('*, users!audit_logs_changed_by_fkey(full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit Log</h1>
      <AuditLogTable logs={logs ?? []} />
      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          {page > 1 && (
            <Link href={`?page=${page - 1}`} className="rounded border px-3 py-1 hover:bg-muted">
              Previous
            </Link>
          )}
          <span className="text-muted-foreground">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`?page=${page + 1}`} className="rounded border px-3 py-1 hover:bg-muted">
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 5: Run all tests**

```bash
npx vitest run
```
Expected: All existing + new tests PASS.

**Step 6: Commit**

```bash
git add src/components/audit-log-table.tsx \
  "src/app/(dashboard)/admin/audit-log/page.tsx" \
  "src/app/(dashboard)/hrbp/audit-log/page.tsx"
git commit -m "refactor: extract shared AuditLogTable component and add pagination to audit log pages"
```

---

### Task 21: Add CSV upload summary UI

**Files:**
- Modify: `src/app/(dashboard)/admin/users/upload/page.tsx`

**Step 1: Read the current upload page**

Read `src/app/(dashboard)/admin/users/upload/page.tsx` before editing.

**Step 2: Convert to client component with useActionState**

```tsx
// src/app/(dashboard)/admin/users/upload/page.tsx
'use client'

import { useActionState } from 'react'
import { uploadUsersCsv } from './actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/submit-button'
import type { ActionResult } from '@/lib/types'

interface UploadSummary { added: number; updated: number; skipped: number; skippedReasons: string[] }
const initial: ActionResult<UploadSummary> = { data: null, error: null }

export default function UploadUsersPage() {
  const [state, formAction] = useActionState(uploadUsersCsv, initial)

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Upload Users CSV</h1>
      <p className="text-sm text-muted-foreground">
        Required columns: <code>zimyo_id</code>, <code>email</code>, <code>full_name</code>.
        Optional: <code>department</code>, <code>designation</code>, <code>manager_email</code>.
      </p>

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="file">CSV File</Label>
          <Input id="file" name="file" type="file" accept=".csv" required />
        </div>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <SubmitButton pendingLabel="Uploading...">Upload</SubmitButton>
      </form>

      {state.data && (
        <div className="rounded-md border bg-muted/30 p-4 space-y-2">
          <p className="font-semibold">Upload complete</p>
          <p className="text-sm">{state.data.added} created, {state.data.updated} updated
            {state.data.skipped > 0 && `, ${state.data.skipped} skipped`}</p>
          {state.data.skippedReasons.length > 0 && (
            <ul className="text-xs text-muted-foreground space-y-1">
              {state.data.skippedReasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 4: Run all tests**

```bash
npx vitest run
```
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add "src/app/(dashboard)/admin/users/upload/page.tsx"
git commit -m "feat: show upload summary (created/updated/skipped) after CSV import"
```

---

## Final Verification

### Task 22: Full test run and smoke test

**Step 1: Run complete test suite**

```bash
npx vitest run
```
Expected: All tests PASS. Note the count.

**Step 2: TypeScript full check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

**Step 3: Start dev server and smoke test key flows**

```bash
npm run dev
```

Visit http://localhost:3000/login and verify:
1. Login as Alice (manager@test.com) → redirected to /manager
2. Visit `/manager/[some-other-employee-id-not-in-team]/kpis?cycle=[id]` → redirected to /manager (IDOR fix)
3. Login as HRBP (hrbp@test.com) → visit /hrbp/calibration?cycle=[Q4-id]
4. Try overriding with empty justification → error displayed inline
5. Login as Admin → create new cycle with sme_multiplier = 10 → error "must be between 0 and 5"
6. Check /admin/audit-log → pagination controls visible if >25 entries
7. Visit /manager/my-review → shows manager's own KPIs and review

**Step 4: Final commit summary**

```bash
git log --oneline -22
```

Expected: 22 commits from this plan, each scoped and descriptive.
