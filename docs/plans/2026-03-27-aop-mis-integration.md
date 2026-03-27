# AOP + Monthly MIS Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate AOP targets and monthly MIS actuals from an external MIS tool into PMS via API, enabling auto-scored performance reviews with manager override.

**Architecture:** PMS mirrors MIS data into local tables (AopTarget, MisActual) via API sync. Managers map KPIs to MIS targets. At review time, the system auto-calculates a weighted achievement score and suggests a rating tier. Manager can accept or override with justification. HRBP calibration shows both.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Prisma 7, NeonDB, server actions, SVG charts (no new deps)

---

## Task 1: Schema — New MIS Tables + Appraisal Fields

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/types.ts`

**Step 1: Add new models to schema.prisma**

Add after the existing `KraTemplate` model:

```prisma
model AopTarget {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  external_id     String   @unique
  fiscal_year     Int
  level           String   // "company", "department", "individual"
  department_id   String?  @db.Uuid
  employee_id     String?  @db.Uuid
  metric_name     String
  category        String   @default("financial") // financial, operational, people, customer, process
  annual_target   Decimal  @db.Decimal(14, 2)
  unit            String   @default("number")
  currency        String?
  monthly_targets Json?    // {1: 350, 2: 380, ...}
  ytd_actual      Decimal? @db.Decimal(14, 2)
  red_threshold   Decimal  @default(80) @db.Decimal(5, 2)
  amber_threshold Decimal  @default(95) @db.Decimal(5, 2)
  synced_at       DateTime @default(now()) @db.Timestamptz(6)
  created_at      DateTime @default(now()) @db.Timestamptz(6)

  department Department? @relation(fields: [department_id], references: [id])
  employee   User?       @relation("AopTargetEmployee", fields: [employee_id], references: [id])
  actuals    MisActual[]
  kpi_mappings KpiMisMapping[]

  @@index([fiscal_year, level], name: "idx_aop_targets_year_level")
  @@index([employee_id], name: "idx_aop_targets_employee")
  @@index([department_id], name: "idx_aop_targets_department")
  @@map("aop_targets")
}

model MisActual {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  aop_target_id  String   @db.Uuid
  year           Int
  month          Int
  actual_value   Decimal  @db.Decimal(14, 2)
  ytd_actual     Decimal? @db.Decimal(14, 2)
  notes          String?
  synced_at      DateTime @default(now()) @db.Timestamptz(6)

  aop_target AopTarget @relation(fields: [aop_target_id], references: [id], onDelete: Cascade)

  @@unique([aop_target_id, year, month], name: "uq_mis_actual_target_month")
  @@map("mis_actuals")
}

model KpiMisMapping {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  kpi_id         String   @db.Uuid
  aop_target_id  String   @db.Uuid
  weight_factor  Decimal  @default(1.0) @db.Decimal(5, 2)
  score_formula  String   @default("linear") // "linear", "capped", "inverse"
  created_at     DateTime @default(now()) @db.Timestamptz(6)

  kpi        Kpi       @relation(fields: [kpi_id], references: [id], onDelete: Cascade)
  aop_target AopTarget @relation(fields: [aop_target_id], references: [id], onDelete: Cascade)

  @@unique([kpi_id, aop_target_id], name: "uq_kpi_mis_mapping")
  @@map("kpi_mis_mappings")
}

model MisSyncLog {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sync_type       String    // "targets", "actuals"
  status          String    // "success", "partial", "failed"
  records_synced  Int       @default(0)
  records_failed  Int       @default(0)
  error_message   String?
  triggered_by    String?   @db.Uuid
  started_at      DateTime  @default(now()) @db.Timestamptz(6)
  completed_at    DateTime? @db.Timestamptz(6)

  trigger_user User? @relation("MisSyncTrigger", fields: [triggered_by], references: [id])

  @@map("mis_sync_logs")
}

model MisConfig {
  id                  String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  api_base_url        String   @default("")
  api_key_encrypted   String   @default("")
  fiscal_year         Int      @default(2026)
  auto_sync_enabled   Boolean  @default(true)
  sync_cron           String   @default("0 6 * * *")
  department_mapping  Json     @default("{}")
  updated_at          DateTime @default(now()) @db.Timestamptz(6)

  @@map("mis_config")
}

model ScoringConfig {
  id          String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  rating_tier RatingTier
  min_score   Decimal    @db.Decimal(5, 2)
  is_active   Boolean    @default(true)

  @@unique([rating_tier], name: "uq_scoring_config_tier")
  @@map("scoring_configs")
}
```

**Step 2: Add relations to existing models**

On `Kpi` model, add:
```prisma
  mis_mappings KpiMisMapping[]
```

On `User` model, add:
```prisma
  aop_targets      AopTarget[]   @relation("AopTargetEmployee")
  mis_sync_logs    MisSyncLog[]  @relation("MisSyncTrigger")
```

On `Department` model, add:
```prisma
  aop_targets AopTarget[]
```

On `Appraisal` model, add after `payout_amount`:
```prisma
  mis_score        Decimal?    @db.Decimal(5, 2)
  suggested_rating RatingTier?
  override_reason  String?
```

**Step 3: Add TypeScript interfaces to `src/lib/types.ts`**

```typescript
export interface AopTarget {
  id: string
  external_id: string
  fiscal_year: number
  level: string
  department_id: string | null
  employee_id: string | null
  metric_name: string
  category: string
  annual_target: number
  unit: string
  currency: string | null
  monthly_targets: Record<string, number> | null
  ytd_actual: number | null
  red_threshold: number
  amber_threshold: number
  synced_at: string
  created_at: string
}

export interface MisActual {
  id: string
  aop_target_id: string
  year: number
  month: number
  actual_value: number
  ytd_actual: number | null
  notes: string | null
  synced_at: string
}

export interface KpiMisMapping {
  id: string
  kpi_id: string
  aop_target_id: string
  weight_factor: number
  score_formula: string
}

export interface MisSyncLog {
  id: string
  sync_type: string
  status: string
  records_synced: number
  records_failed: number
  error_message: string | null
  triggered_by: string | null
  started_at: string
  completed_at: string | null
}

export interface MisConfig {
  id: string
  api_base_url: string
  api_key_encrypted: string
  fiscal_year: number
  auto_sync_enabled: boolean
  sync_cron: string
  department_mapping: Record<string, string>
  updated_at: string
}

export interface ScoringConfig {
  id: string
  rating_tier: string
  min_score: number
  is_active: boolean
}
```

**Step 4: Generate + verify**
```bash
npx prisma generate
npx tsc --noEmit
```

**Step 5: Commit**
```bash
git add prisma/schema.prisma src/lib/types.ts
git commit -m "feat: add MIS integration schema — AopTarget, MisActual, KpiMisMapping, ScoringConfig"
```

---

## Task 2: MIS Sync Service

**Files:**
- Create: `src/lib/mis-sync.ts`
- Create: `src/lib/mis-api-client.ts`

**Step 1: Create MIS API client**

`src/lib/mis-api-client.ts` — A thin HTTP client that calls the MIS tool's API:

```typescript
import { prisma } from '@/lib/prisma'

interface MisApiConfig {
  baseUrl: string
  apiKey: string
}

async function getConfig(): Promise<MisApiConfig> {
  const config = await prisma.misConfig.findFirst()
  if (!config || !config.api_base_url || !config.api_key_encrypted) {
    throw new Error('MIS API not configured — set API URL and key in /admin/mis/settings')
  }
  return { baseUrl: config.api_base_url, apiKey: config.api_key_encrypted }
}

async function fetchMis<T>(path: string, params: Record<string, string>): Promise<T> {
  const { baseUrl, apiKey } = await getConfig()
  const url = new URL(path, baseUrl)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`MIS API error ${res.status}: ${await res.text()}`)
  return res.json()
}

export async function fetchAopTargets(fiscalYear: number, updatedSince?: string) {
  const params: Record<string, string> = { fiscal_year: String(fiscalYear) }
  if (updatedSince) params.updated_since = updatedSince
  return fetchMis<{ data: any[]; meta: { total: number } }>('/api/v1/aop/targets', params)
}

export async function fetchMisActuals(fiscalYear: number, month: number, updatedSince?: string) {
  const params: Record<string, string> = { fiscal_year: String(fiscalYear), month: String(month) }
  if (updatedSince) params.updated_since = updatedSince
  return fetchMis<{ data: any[]; meta: { total: number } }>('/api/v1/mis/actuals', params)
}

export async function checkMisHealth(): Promise<boolean> {
  try {
    const { baseUrl, apiKey } = await getConfig()
    const res = await fetch(new URL('/api/v1/health', baseUrl).toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    return res.ok
  } catch { return false }
}
```

**Step 2: Create sync service**

`src/lib/mis-sync.ts` — Orchestrates the full sync flow:

```typescript
import { prisma } from '@/lib/prisma'
import { fetchAopTargets, fetchMisActuals } from './mis-api-client'

export async function syncTargets(fiscalYear: number, triggeredBy?: string): Promise<{ synced: number; failed: number }> {
  const log = await prisma.misSyncLog.create({
    data: { sync_type: 'targets', status: 'running', triggered_by: triggeredBy },
  })

  try {
    const config = await prisma.misConfig.findFirst()
    const deptMapping: Record<string, string> = (config?.department_mapping as any) || {}
    const lastSync = await prisma.misSyncLog.findFirst({
      where: { sync_type: 'targets', status: 'success' },
      orderBy: { completed_at: 'desc' },
      select: { completed_at: true },
    })

    const { data } = await fetchAopTargets(fiscalYear, lastSync?.completed_at?.toISOString())

    let synced = 0, failed = 0
    for (const t of data) {
      try {
        // Resolve department
        let departmentId: string | null = null
        if (t.department_code && deptMapping[t.department_code]) {
          departmentId = deptMapping[t.department_code]
        }

        // Resolve employee by email
        let employeeId: string | null = null
        if (t.employee_email) {
          const user = await prisma.user.findFirst({ where: { email: t.employee_email }, select: { id: true } })
          employeeId = user?.id || null
        }

        await prisma.aopTarget.upsert({
          where: { external_id: t.id },
          create: {
            external_id: t.id,
            fiscal_year: fiscalYear,
            level: t.level,
            department_id: departmentId,
            employee_id: employeeId,
            metric_name: t.metric_name,
            category: t.category || 'financial',
            annual_target: t.annual_target,
            unit: t.unit || 'number',
            currency: t.currency,
            monthly_targets: t.monthly_targets,
            red_threshold: t.red_threshold || 80,
            amber_threshold: t.amber_threshold || 95,
            synced_at: new Date(),
          },
          update: {
            level: t.level,
            department_id: departmentId,
            employee_id: employeeId,
            metric_name: t.metric_name,
            category: t.category || 'financial',
            annual_target: t.annual_target,
            unit: t.unit || 'number',
            currency: t.currency,
            monthly_targets: t.monthly_targets,
            red_threshold: t.red_threshold || 80,
            amber_threshold: t.amber_threshold || 95,
            synced_at: new Date(),
          },
        })
        synced++
      } catch { failed++ }
    }

    await prisma.misSyncLog.update({
      where: { id: log.id },
      data: { status: failed > 0 ? 'partial' : 'success', records_synced: synced, records_failed: failed, completed_at: new Date() },
    })
    return { synced, failed }
  } catch (e) {
    await prisma.misSyncLog.update({
      where: { id: log.id },
      data: { status: 'failed', error_message: e instanceof Error ? e.message : 'Unknown error', completed_at: new Date() },
    })
    throw e
  }
}

export async function syncActuals(fiscalYear: number, month: number, triggeredBy?: string): Promise<{ synced: number; failed: number }> {
  const log = await prisma.misSyncLog.create({
    data: { sync_type: 'actuals', status: 'running', triggered_by: triggeredBy },
  })

  try {
    const { data } = await fetchMisActuals(fiscalYear, month)
    let synced = 0, failed = 0

    for (const a of data) {
      try {
        const target = await prisma.aopTarget.findUnique({ where: { external_id: a.target_id }, select: { id: true } })
        if (!target) { failed++; continue }

        await prisma.misActual.upsert({
          where: { uq_mis_actual_target_month: { aop_target_id: target.id, year: a.year, month: a.month } },
          create: {
            aop_target_id: target.id,
            year: a.year,
            month: a.month,
            actual_value: a.actual_value,
            ytd_actual: a.ytd_actual,
            notes: a.notes,
            synced_at: new Date(),
          },
          update: {
            actual_value: a.actual_value,
            ytd_actual: a.ytd_actual,
            notes: a.notes,
            synced_at: new Date(),
          },
        })

        // Update ytd_actual on parent AopTarget
        if (a.ytd_actual != null) {
          await prisma.aopTarget.update({
            where: { id: target.id },
            data: { ytd_actual: a.ytd_actual },
          })
        }

        synced++
      } catch { failed++ }
    }

    await prisma.misSyncLog.update({
      where: { id: log.id },
      data: { status: failed > 0 ? 'partial' : 'success', records_synced: synced, records_failed: failed, completed_at: new Date() },
    })
    return { synced, failed }
  } catch (e) {
    await prisma.misSyncLog.update({
      where: { id: log.id },
      data: { status: 'failed', error_message: e instanceof Error ? e.message : 'Unknown error', completed_at: new Date() },
    })
    throw e
  }
}
```

**Step 3: Verify + commit**
```bash
npx tsc --noEmit
git add src/lib/mis-sync.ts src/lib/mis-api-client.ts
git commit -m "feat: MIS sync service — target and actuals sync with audit logging"
```

---

## Task 3: Auto-Scoring Engine

**Files:**
- Create: `src/lib/mis-scoring.ts`

**Step 1: Create the scoring engine**

```typescript
import { prisma } from '@/lib/prisma'
import type { RatingTier } from '@prisma/client'

interface KpiScore {
  kpi_id: string
  kpi_title: string
  target: number
  actual: number
  achievement_pct: number
  formula: string
  weight: number
  weighted_score: number
}

interface EmployeeScore {
  employee_id: string
  mis_score: number
  suggested_rating: RatingTier
  kpi_scores: KpiScore[]
}

function applyFormula(formula: string, actual: number, target: number): number {
  if (target === 0) return 0
  switch (formula) {
    case 'inverse': return (target / actual) * 100     // lower is better (cost metrics)
    case 'capped':  return Math.min((actual / target) * 100, 100)
    default:        return (actual / target) * 100      // linear
  }
}

async function getRatingForScore(score: number): Promise<RatingTier> {
  const configs = await prisma.scoringConfig.findMany({
    where: { is_active: true },
    orderBy: { min_score: 'desc' },
  })
  for (const c of configs) {
    if (score >= Number(c.min_score)) return c.rating_tier
  }
  return 'BE' as RatingTier
}

export async function calculateEmployeeScore(employeeId: string, cycleId: string): Promise<EmployeeScore | null> {
  // Get all KPIs for employee in cycle with MIS mappings
  const kpis = await prisma.kpi.findMany({
    where: { cycle_id: cycleId, employee_id: employeeId },
    include: {
      mis_mappings: {
        include: {
          aop_target: true,
        },
      },
    },
  })

  const mappedKpis = kpis.filter(k => k.mis_mappings.length > 0)
  if (mappedKpis.length === 0) return null

  const kpiScores: KpiScore[] = []
  let totalWeight = 0

  for (const kpi of mappedKpis) {
    const mapping = kpi.mis_mappings[0] // Use first mapping
    const target = mapping.aop_target
    const kpiWeight = Number(kpi.weight || 0)

    // Use ytd_actual vs proportional annual target (months elapsed)
    const currentMonth = new Date().getMonth() + 1
    const proportionalTarget = Number(target.annual_target) * (currentMonth / 12)
    const actual = Number(target.ytd_actual || 0)

    const achievement = applyFormula(mapping.score_formula, actual, proportionalTarget)

    kpiScores.push({
      kpi_id: kpi.id,
      kpi_title: kpi.title,
      target: proportionalTarget,
      actual,
      achievement_pct: Math.round(achievement * 100) / 100,
      formula: mapping.score_formula,
      weight: kpiWeight,
      weighted_score: achievement * (kpiWeight / 100),
    })
    totalWeight += kpiWeight
  }

  // Normalize if total weight of mapped KPIs < 100
  const rawScore = kpiScores.reduce((sum, k) => sum + k.weighted_score, 0)
  const misScore = totalWeight > 0 ? (rawScore / totalWeight) * 100 : 0
  const roundedScore = Math.round(misScore * 100) / 100

  const suggestedRating = await getRatingForScore(roundedScore)

  return {
    employee_id: employeeId,
    mis_score: roundedScore,
    suggested_rating: suggestedRating,
    kpi_scores: kpiScores,
  }
}

export async function bulkCalculateScores(cycleId: string): Promise<number> {
  const appraisals = await prisma.appraisal.findMany({
    where: { cycle_id: cycleId },
    select: { employee_id: true },
  })

  let updated = 0
  for (const a of appraisals) {
    const score = await calculateEmployeeScore(a.employee_id, cycleId)
    if (score) {
      await prisma.appraisal.update({
        where: { cycle_id_employee_id: { cycle_id: cycleId, employee_id: a.employee_id } },
        data: {
          mis_score: score.mis_score,
          suggested_rating: score.suggested_rating,
        },
      })
      updated++
    }
  }
  return updated
}
```

**Step 2: Verify + commit**
```bash
npx tsc --noEmit
git add src/lib/mis-scoring.ts
git commit -m "feat: MIS auto-scoring engine — weighted KPI achievement with formula support"
```

---

## Task 4: Admin MIS Settings Page

**Files:**
- Create: `src/app/(dashboard)/admin/mis/settings/page.tsx`
- Create: `src/app/(dashboard)/admin/mis/settings/actions.ts`
- Create: `src/app/(dashboard)/admin/mis/settings/settings-form.tsx`

Build the admin settings page following the existing KRA template admin pattern:
- Server component fetches MisConfig + ScoringConfig + departments
- Client form (`'use client'` with `useActionState`) for editing:
  - API Base URL, API Key, Fiscal Year
  - Auto-sync toggle + cron expression
  - Department code → PMS department dropdown mappings
  - Scoring thresholds (FEE/EE/ME/SME/BE min scores)
- Server actions: `saveMisConfig`, `saveScoringConfig`, `testMisConnection`
- `testMisConnection` calls `checkMisHealth()` and returns success/failure
- Seed default ScoringConfig rows on first load if empty (FEE≥110, EE≥95, ME≥80, SME≥60)

**Step 1: Create actions, form, page**

**Step 2: Verify + commit**
```bash
npx tsc --noEmit
git add src/app/(dashboard)/admin/mis/
git commit -m "feat: admin MIS settings — API config, scoring thresholds, department mapping"
```

---

## Task 5: Admin MIS Dashboard (Sync + Overview)

**Files:**
- Create: `src/app/(dashboard)/admin/mis/page.tsx`
- Create: `src/app/(dashboard)/admin/mis/actions.ts`

Build the sync dashboard:
- Header: "MIS Integration" + "Sync Now" button
- Stats bar: last sync time, total targets, status badge
- Table of AopTargets filterable by: category (BSC pillars), level (company/dept/individual)
- Each row: metric_name, level, target, ytd_actual, achievement %, RAG badge
- RAG logic: achievement ≥ amber_threshold → green, ≥ red_threshold → amber, else red
- Unmapped targets alert: count of individual-level targets with no KpiMisMapping
- Sync history: last 10 MisSyncLog entries with status, counts, timestamps
- Server action: `triggerSync` — calls `syncTargets()` + `syncActuals()` for current month

**Step 1: Create actions + page**

**Step 2: Verify + commit**
```bash
npx tsc --noEmit
git add src/app/(dashboard)/admin/mis/
git commit -m "feat: admin MIS dashboard — sync trigger, target overview, RAG status"
```

---

## Task 6: KPI-to-MIS Mapping UI (Manager Side)

**Files:**
- Modify: `src/app/(dashboard)/manager/[employeeId]/kpis/page.tsx`
- Create: `src/components/kpi-mis-link.tsx`
- Create: `src/app/(dashboard)/manager/mis-mapping-actions.ts`

Add "Link to MIS" button on each KPI in the KPI setting page:
- `KpiMisLink` — client component (Dialog) that:
  - Fetches available AopTargets for the employee (individual-level, matching employee_id)
  - Shows dropdown of available targets with metric_name + category badge
  - Select score formula: linear (default), capped, inverse
  - On save: creates/updates KpiMisMapping record
  - Shows current mapping status (linked target name or "unmapped")
- Server actions: `linkKpiToMis(kpiId, aopTargetId, formula)`, `unlinkKpiFromMis(kpiId)`
- Auto-suggest: highlight targets where `metric_name` fuzzy-matches `kpi.title`
- Display on KPI card: small "MIS: Revenue Target" badge if mapped, or "Link to MIS" button if not

**Step 1: Create component + actions**

**Step 2: Update KPI setting page to show link status**

**Step 3: Verify + commit**
```bash
npx tsc --noEmit
git add src/components/kpi-mis-link.tsx src/app/(dashboard)/manager/mis-mapping-actions.ts src/app/(dashboard)/manager/[employeeId]/kpis/page.tsx
git commit -m "feat: KPI-to-MIS mapping UI — link KPIs to AOP targets with formula selection"
```

---

## Task 7: Manager Review — Auto-Score Display

**Files:**
- Modify: `src/app/(dashboard)/manager/[employeeId]/review/page.tsx`
- Modify: `src/app/(dashboard)/manager/actions.ts`

Update the manager review page:
- Fetch employee's MIS score via `calculateEmployeeScore(employeeId, cycleId)`
- Show auto-score sidebar panel next to the rating form:
  ```
  System suggests: EE (97.2%)
  ├── Revenue Target: 99% (weight 30%) → 29.7
  ├── Sprint Velocity: 95% (weight 25%) → 23.8
  └── Client NPS: 90% (weight 25%) → 22.5
  Weighted total: 93.0%
  ```
- Pre-fill the rating dropdown with `suggested_rating`
- If manager selects a different rating: show "Override reason" textarea (required)
- Update `submitManagerRating` action to save `override_reason` if provided
- Glass styling on the auto-score panel

**Step 1: Update review page + action**

**Step 2: Verify + commit**
```bash
npx tsc --noEmit
git add src/app/(dashboard)/manager/[employeeId]/review/page.tsx src/app/(dashboard)/manager/actions.ts
git commit -m "feat: manager review shows MIS auto-score with override justification"
```

---

## Task 8: HRBP Calibration — Auto-Score Column

**Files:**
- Modify: `src/app/(dashboard)/hrbp/calibration/page.tsx`

Update calibration page to show both scores:
- Add "MIS Score" and "Suggested" columns to the calibration table
- Fetch `mis_score` and `suggested_rating` from Appraisal records
- Highlight rows where manager_rating differs from suggested_rating (override indicator)
- Show override_reason on hover/expand
- RAG badge on MIS score column

**Step 1: Update calibration page**

**Step 2: Verify + commit**
```bash
npx tsc --noEmit
git add src/app/(dashboard)/hrbp/calibration/page.tsx
git commit -m "feat: HRBP calibration shows MIS auto-score vs manager rating with override flags"
```

---

## Task 9: Employee MIS Dashboard

**Files:**
- Create: `src/app/(dashboard)/employee/mis/page.tsx`

Employee's personal MIS view:
- Fetch individual-level AopTargets for the employee + all MisActuals
- For each target: glass card with:
  - Metric name, category badge, annual target, YTD actual
  - Achievement % with RAG badge and animated counter
  - 12-month SVG bar chart (actual bars + target line)
- SVG chart: `<svg>` with `<rect>` bars per month (actual value) and `<line>` for monthly target
  - Bars use `barGrow` animation
  - Target line is dashed
  - Current month highlighted
- Empty state if no MIS data synced yet

**Step 1: Create MIS dashboard page with SVG charts**

**Step 2: Verify + commit**
```bash
npx tsc --noEmit
git add src/app/(dashboard)/employee/mis/
git commit -m "feat: employee MIS dashboard — personal targets with 12-month trend charts"
```

---

## Task 10: Manager MIS Team View

**Files:**
- Create: `src/app/(dashboard)/manager/mis/page.tsx`

Manager's team MIS view:
- Fetch all direct reports' AopTargets + actuals
- Month picker (prev/next navigation via searchParams `?month=3`)
- Per-employee expandable rows:
  - Employee name, overall achievement %, RAG badge
  - Expand → list of mapped metrics with individual achievement %
- Summary stats at top: team average achievement, count at risk (red), on track (green)
- Glass styling

**Step 1: Create manager MIS page**

**Step 2: Verify + commit**
```bash
npx tsc --noEmit
git add src/app/(dashboard)/manager/mis/
git commit -m "feat: manager MIS team view — monthly performance tracking with RAG status"
```

---

## Task 11: HRBP MIS Department View

**Files:**
- Create: `src/app/(dashboard)/hrbp/mis/page.tsx`

HRBP department-level MIS overview:
- Fetch department-level + individual AopTargets for HRBP's departments
- Department-level metrics: glass cards with achievement %
- Employee breakdown table: achievement by employee within department
- Variance analysis: biggest overperformers and underperformers
- Month picker like manager view

**Step 1: Create HRBP MIS page**

**Step 2: Verify + commit**
```bash
npx tsc --noEmit
git add src/app/(dashboard)/hrbp/mis/
git commit -m "feat: HRBP MIS department overview — department metrics and employee variance"
```

---

## Task 12: Sidebar Navigation + Employee Dashboard MIS Card

**Files:**
- Modify: `src/components/sidebar.tsx`
- Modify: `src/app/(dashboard)/employee/page.tsx`

Sidebar updates:
- Employee section: add "MIS Targets" link → `/employee/mis` (icon: BarChart3)
- Manager section: add "MIS Tracking" link → `/manager/mis` (icon: BarChart3)
- HRBP section: add "MIS Overview" link → `/hrbp/mis` (icon: BarChart3)
- Admin section: add "MIS Integration" link → `/admin/mis` (icon: FileSpreadsheet)

Employee dashboard:
- Add a MIS summary card below the KPI section
- Shows top 3 mapped metrics with achievement % and RAG mini-badges
- "View all →" link to `/employee/mis`

**Step 1: Update sidebar + employee dashboard**

**Step 2: Verify + commit**
```bash
npx tsc --noEmit
git add src/components/sidebar.tsx src/app/(dashboard)/employee/page.tsx
git commit -m "feat: MIS navigation links in sidebar + employee dashboard MIS summary card"
```

---

## Task 13: Final Verification

**Files:** None (verification only)

**Step 1: TypeScript check**
```bash
npx tsc --noEmit
```

**Step 2: Push DB schema**
```bash
npx prisma db push
```

**Step 3: Seed default scoring config**
Verify ScoringConfig has default rows (FEE≥110, EE≥95, ME≥80, SME≥60).

**Step 4: Verify all pages load**
Navigate through: admin MIS dashboard, admin MIS settings, manager KPI setting (link to MIS), manager review (auto-score), employee MIS, manager MIS, HRBP MIS, HRBP calibration.

**Step 5: Merge to master + push**
```bash
git checkout master
git merge claude/charming-bouman --no-edit
git push origin master
npx prisma db push  # sync NeonDB
```
