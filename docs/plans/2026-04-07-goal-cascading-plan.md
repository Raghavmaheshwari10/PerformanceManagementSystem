# Goal Cascading — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a 3-level goal cascade (Org Goals → Dept Goals → Individual KPIs) with automatic progress rollup from KPI scores, tree view UI, and role-based CRUD.

**Architecture:** Two new Prisma models (`OrgGoal`, `DeptGoal`) + one optional FK on existing `Kpi` model. Single client component `GoalCascadingDashboard` with `role` prop. Server actions for CRUD. 3 role-scoped route pages.

**Tech Stack:** Next.js 16, React 19, Prisma 7, Recharts (progress bars), Tailwind v4, Vitest

---

### Task 1: Schema — OrgGoal and DeptGoal models

**Files:**
- Modify: `prisma/schema.prisma`

**Reference files:**
- `prisma/schema.prisma` — existing `Kpi` model (line 366-395), `Cycle`, `Department`, `User` models

**Step 1: Add OrgGoal model**

After the existing models (before the end of file), add:

```prisma
model OrgGoal {
  id          String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  title       String
  description String?
  cycle_id    String?    @db.Uuid
  created_by  String     @db.Uuid
  created_at  DateTime   @default(now()) @db.Timestamptz(6)
  updated_at  DateTime   @default(now()) @updatedAt @db.Timestamptz(6)

  cycle      Cycle?     @relation(fields: [cycle_id], references: [id])
  creator    User       @relation("OrgGoalCreator", fields: [created_by], references: [id])
  dept_goals DeptGoal[]

  @@map("org_goals")
}

model DeptGoal {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  title         String
  description   String?
  org_goal_id   String   @db.Uuid
  department_id String   @db.Uuid
  created_by    String   @db.Uuid
  created_at    DateTime @default(now()) @db.Timestamptz(6)
  updated_at    DateTime @default(now()) @updatedAt @db.Timestamptz(6)

  org_goal   OrgGoal    @relation(fields: [org_goal_id], references: [id], onDelete: Cascade)
  department Department @relation(fields: [department_id], references: [id])
  creator    User       @relation("DeptGoalCreator", fields: [created_by], references: [id])
  kpis       Kpi[]

  @@map("dept_goals")
}
```

**Step 2: Add FK to existing Kpi model**

In the `Kpi` model (line 366-395), add after the `kra_id` field:

```prisma
  dept_goal_id  String?  @db.Uuid
```

And in the relations section, add:

```prisma
  dept_goal DeptGoal? @relation(fields: [dept_goal_id], references: [id], onDelete: SetNull)
```

**Step 3: Add inverse relations on User, Cycle, Department models**

In the `User` model, add:
```prisma
  org_goals_created  OrgGoal[]  @relation("OrgGoalCreator")
  dept_goals_created DeptGoal[] @relation("DeptGoalCreator")
```

In the `Cycle` model, add:
```prisma
  org_goals OrgGoal[]
```

In the `Department` model, add:
```prisma
  dept_goals DeptGoal[]
```

**Step 4: Generate Prisma client**

```bash
npx prisma generate
```

**Step 5: Create migration script**

Create `scripts/create-goal-cascading-tables.mjs`:

```javascript
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

async function main() {
  console.log('Creating goal cascading tables...')

  await sql`
    CREATE TABLE IF NOT EXISTS org_goals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      cycle_id UUID REFERENCES cycles(id),
      created_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
    )
  `
  console.log('✓ org_goals table created')

  await sql`
    CREATE TABLE IF NOT EXISTS dept_goals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      org_goal_id UUID NOT NULL REFERENCES org_goals(id) ON DELETE CASCADE,
      department_id UUID NOT NULL REFERENCES departments(id),
      created_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
    )
  `
  console.log('✓ dept_goals table created')

  // Add dept_goal_id FK to kpis table
  await sql`
    ALTER TABLE kpis
    ADD COLUMN IF NOT EXISTS dept_goal_id UUID REFERENCES dept_goals(id) ON DELETE SET NULL
  `
  console.log('✓ dept_goal_id column added to kpis')

  console.log('Done!')
}

main().catch(console.error)
```

**Step 6: Commit**

```bash
git add prisma/schema.prisma scripts/create-goal-cascading-tables.mjs
git commit -m "feat(goal-cascading): add OrgGoal, DeptGoal schema + migration script"
```

---

### Task 2: Data layer — goal cascading queries

**Files:**
- Create: `src/lib/db/goal-cascading.ts`

**Reference files:**
- `src/lib/db/top-talent.ts` — query pattern (resolve cycle → batch fetch → build maps → compute)
- `prisma/schema.prisma` — `OrgGoal`, `DeptGoal`, `Kpi`, `Appraisal` models

**Step 1: Create file with types**

```typescript
import { prisma } from '@/lib/prisma'

/* ── Types ── */

export interface GoalTreeKpi {
  id: string
  title: string
  weight: number | null
  score: number | null  // 0-100 from appraisal or manager rating
  employeeName: string
}

export interface GoalTreeDeptGoal {
  id: string
  title: string
  description: string | null
  department: string
  departmentId: string
  creatorName: string
  progress: number  // 0-100, weighted avg of linked KPI scores
  kpiCount: number
  kpis: GoalTreeKpi[]
}

export interface GoalTreeOrgGoal {
  id: string
  title: string
  description: string | null
  cycleName: string | null
  cycleId: string | null
  creatorName: string
  progress: number  // 0-100, avg of dept goal progresses
  deptGoalCount: number
  deptGoals: GoalTreeDeptGoal[]
}

export interface GoalCascadingStats {
  totalOrgGoals: number
  avgCompletion: number
  deptsOnTrack: number   // depts with avg progress >= 50
  deptsBehind: number    // depts with avg progress < 50
  unlinkedKpis: number   // KPIs without dept_goal_id for current cycle
}
```

**Step 2: Implement `fetchGoalTree`**

```typescript
export async function fetchGoalTree(options?: {
  cycleId?: string
  departmentId?: string
  managerId?: string
}): Promise<GoalTreeOrgGoal[]> {
  // Resolve cycle
  const targetCycle = options?.cycleId
    ? await prisma.cycle.findUnique({ where: { id: options.cycleId }, select: { id: true, name: true } })
    : await prisma.cycle.findFirst({
        where: { status: 'published' },
        orderBy: { published_at: 'desc' },
        select: { id: true, name: true },
      })

  // Fetch org goals (optionally filtered by cycle)
  const orgGoalWhere: any = {}
  if (targetCycle) orgGoalWhere.cycle_id = targetCycle.id

  const orgGoals = await prisma.orgGoal.findMany({
    where: orgGoalWhere,
    include: {
      creator: { select: { full_name: true } },
      cycle: { select: { name: true } },
      dept_goals: {
        where: options?.departmentId ? { department_id: options.departmentId } : undefined,
        include: {
          department: { select: { name: true, id: true } },
          creator: { select: { full_name: true } },
          kpis: {
            where: options?.managerId ? { manager_id: options.managerId } : undefined,
            select: {
              id: true,
              title: true,
              weight: true,
              employee: { select: { full_name: true } },
              employee_id: true,
              cycle_id: true,
            },
          },
        },
      },
    },
    orderBy: { created_at: 'asc' },
  })

  if (orgGoals.length === 0) return []

  // Batch-fetch appraisal scores for all KPIs in one query
  const allKpiEmployeeCyclePairs: Array<{ employee_id: string; cycle_id: string }> = []
  const kpiMap = new Map<string, { employeeId: string; cycleId: string }>()

  for (const og of orgGoals) {
    for (const dg of og.dept_goals) {
      for (const kpi of dg.kpis) {
        kpiMap.set(kpi.id, { employeeId: kpi.employee_id, cycleId: kpi.cycle_id })
        allKpiEmployeeCyclePairs.push({ employee_id: kpi.employee_id, cycle_id: kpi.cycle_id })
      }
    }
  }

  // Get appraisal final scores for these employees/cycles
  const uniquePairs = Array.from(new Set(allKpiEmployeeCyclePairs.map(p => `${p.employee_id}|${p.cycle_id}`)))
  const appraisals = uniquePairs.length > 0
    ? await prisma.appraisal.findMany({
        where: {
          OR: uniquePairs.map(pair => {
            const [eid, cid] = pair.split('|')
            return { employee_id: eid, cycle_id: cid }
          }),
        },
        select: { employee_id: true, cycle_id: true, final_score: true },
      })
    : []

  const scoreMap = new Map(appraisals.map(a => [
    `${a.employee_id}|${a.cycle_id}`,
    a.final_score != null ? Number(a.final_score) : null,
  ]))

  // Also get KPI-level manager ratings as fallback
  const allKpiIds = Array.from(kpiMap.keys())
  const kpiRatings = allKpiIds.length > 0
    ? await prisma.kpi.findMany({
        where: { id: { in: allKpiIds } },
        select: { id: true, manager_rating: true },
      })
    : []

  const RATING_SCORE: Record<string, number> = {
    FEE: 95, EE: 80, ME: 60, SME: 40, BE: 20,
  }
  const kpiRatingMap = new Map(kpiRatings.map(k => [
    k.id,
    k.manager_rating ? RATING_SCORE[k.manager_rating] ?? null : null,
  ]))

  // Build tree with progress
  return orgGoals.map(og => {
    const deptGoals: GoalTreeDeptGoal[] = og.dept_goals.map(dg => {
      const kpis: GoalTreeKpi[] = dg.kpis.map(kpi => {
        const pair = kpiMap.get(kpi.id)!
        const appraisalScore = scoreMap.get(`${pair.employeeId}|${pair.cycleId}`)
        const ratingScore = kpiRatingMap.get(kpi.id)
        return {
          id: kpi.id,
          title: kpi.title,
          weight: kpi.weight != null ? Number(kpi.weight) : null,
          score: appraisalScore ?? ratingScore ?? null,
          employeeName: kpi.employee?.full_name ?? '',
        }
      })

      // Progress: weighted avg of KPI scores
      let progress = 0
      const kpisWithScores = kpis.filter(k => k.score != null)
      if (kpisWithScores.length > 0) {
        const totalWeight = kpisWithScores.reduce((s, k) => s + (k.weight ?? 1), 0)
        if (totalWeight > 0) {
          progress = Math.round(
            kpisWithScores.reduce((s, k) => s + k.score! * (k.weight ?? 1), 0) / totalWeight
          )
        }
      }

      return {
        id: dg.id,
        title: dg.title,
        description: dg.description,
        department: dg.department?.name ?? '-',
        departmentId: dg.department?.id ?? '',
        creatorName: dg.creator?.full_name ?? '',
        progress,
        kpiCount: kpis.length,
        kpis,
      }
    })

    // Org goal progress: avg of dept goal progresses (equal weight)
    const deptGoalsWithKpis = deptGoals.filter(dg => dg.kpiCount > 0)
    const orgProgress = deptGoalsWithKpis.length > 0
      ? Math.round(deptGoalsWithKpis.reduce((s, dg) => s + dg.progress, 0) / deptGoalsWithKpis.length)
      : 0

    return {
      id: og.id,
      title: og.title,
      description: og.description,
      cycleName: og.cycle?.name ?? null,
      cycleId: og.cycle_id,
      creatorName: og.creator?.full_name ?? '',
      progress: orgProgress,
      deptGoalCount: deptGoals.length,
      deptGoals,
    }
  })
}
```

**Step 3: Implement `fetchGoalCascadingStats`**

```typescript
export async function fetchGoalCascadingStats(options?: {
  cycleId?: string
  managerId?: string
}): Promise<GoalCascadingStats> {
  const tree = await fetchGoalTree(options)

  const totalOrgGoals = tree.length

  // Avg completion across all org goals
  const avgCompletion = totalOrgGoals > 0
    ? Math.round(tree.reduce((s, og) => s + og.progress, 0) / totalOrgGoals)
    : 0

  // Depts on track vs behind
  const deptProgressMap = new Map<string, number[]>()
  for (const og of tree) {
    for (const dg of og.deptGoals) {
      const arr = deptProgressMap.get(dg.department) ?? []
      arr.push(dg.progress)
      deptProgressMap.set(dg.department, arr)
    }
  }

  let deptsOnTrack = 0
  let deptsBehind = 0
  for (const [, progresses] of deptProgressMap) {
    const avg = progresses.reduce((s, v) => s + v, 0) / progresses.length
    if (avg >= 50) deptsOnTrack++
    else deptsBehind++
  }

  // Unlinked KPIs for current cycle
  const targetCycle = options?.cycleId
    ? { id: options.cycleId }
    : await prisma.cycle.findFirst({
        where: { status: 'published' },
        orderBy: { published_at: 'desc' },
        select: { id: true },
      })

  let unlinkedKpis = 0
  if (targetCycle) {
    const where: any = { cycle_id: targetCycle.id, dept_goal_id: null }
    if (options?.managerId) where.manager_id = options.managerId
    unlinkedKpis = await prisma.kpi.count({ where })
  }

  return { totalOrgGoals, avgCompletion, deptsOnTrack, deptsBehind, unlinkedKpis }
}
```

**Step 4: Implement CRUD helpers**

```typescript
/* ── CRUD ── */

export async function createOrgGoal(data: {
  title: string
  description?: string
  cycleId?: string
  createdBy: string
}) {
  return prisma.orgGoal.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      cycle_id: data.cycleId ?? null,
      created_by: data.createdBy,
    },
  })
}

export async function updateOrgGoal(id: string, data: {
  title?: string
  description?: string
  cycleId?: string
}) {
  return prisma.orgGoal.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.cycleId !== undefined && { cycle_id: data.cycleId }),
    },
  })
}

export async function deleteOrgGoal(id: string) {
  return prisma.orgGoal.delete({ where: { id } })
}

export async function createDeptGoal(data: {
  title: string
  description?: string
  orgGoalId: string
  departmentId: string
  createdBy: string
}) {
  return prisma.deptGoal.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      org_goal_id: data.orgGoalId,
      department_id: data.departmentId,
      created_by: data.createdBy,
    },
  })
}

export async function updateDeptGoal(id: string, data: {
  title?: string
  description?: string
}) {
  return prisma.deptGoal.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
    },
  })
}

export async function deleteDeptGoal(id: string) {
  return prisma.deptGoal.delete({ where: { id } })
}

export async function linkKpiToDeptGoal(kpiId: string, deptGoalId: string) {
  return prisma.kpi.update({
    where: { id: kpiId },
    data: { dept_goal_id: deptGoalId },
  })
}

export async function unlinkKpi(kpiId: string) {
  return prisma.kpi.update({
    where: { id: kpiId },
    data: { dept_goal_id: null },
  })
}
```

**Step 5: Commit**

```bash
git add src/lib/db/goal-cascading.ts
git commit -m "feat(goal-cascading): add data layer with tree query, stats, and CRUD helpers"
```

---

### Task 3: Tests — goal cascading data layer

**Files:**
- Create: `src/lib/__tests__/goal-cascading.test.ts`

**Reference files:**
- `src/lib/__tests__/top-talent.test.ts` — mock pattern

**Step 1: Write test file**

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cycle: { findUnique: vi.fn(), findFirst: vi.fn() },
    orgGoal: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    deptGoal: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    kpi: { findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
    appraisal: { findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import {
  fetchGoalTree,
  fetchGoalCascadingStats,
  createOrgGoal,
  linkKpiToDeptGoal,
  unlinkKpi,
} from '@/lib/db/goal-cascading'

const mockPrisma = prisma as any

beforeEach(() => vi.clearAllMocks())

describe('fetchGoalTree', () => {
  it('returns empty when no org goals', async () => {
    mockPrisma.cycle.findFirst.mockResolvedValue({ id: 'c1', name: 'Q1' })
    mockPrisma.orgGoal.findMany.mockResolvedValue([])
    const result = await fetchGoalTree()
    expect(result).toEqual([])
  })

  it('computes progress from KPI scores', async () => {
    mockPrisma.cycle.findFirst.mockResolvedValue({ id: 'c1', name: 'Q1' })
    mockPrisma.orgGoal.findMany.mockResolvedValue([{
      id: 'og1',
      title: 'Grow Revenue',
      description: null,
      cycle_id: 'c1',
      creator: { full_name: 'Admin' },
      cycle: { name: 'Q1' },
      dept_goals: [{
        id: 'dg1',
        title: 'Sales Target',
        description: null,
        department: { name: 'Sales', id: 'dept-1' },
        creator: { full_name: 'HRBP' },
        kpis: [
          { id: 'k1', title: 'Close deals', weight: 60, employee_id: 'e1', cycle_id: 'c1', employee: { full_name: 'Alice' } },
          { id: 'k2', title: 'Pipeline', weight: 40, employee_id: 'e2', cycle_id: 'c1', employee: { full_name: 'Bob' } },
        ],
      }],
    }])
    // Appraisal scores
    mockPrisma.appraisal.findMany.mockResolvedValue([
      { employee_id: 'e1', cycle_id: 'c1', final_score: 80 },
      { employee_id: 'e2', cycle_id: 'c1', final_score: 60 },
    ])
    mockPrisma.kpi.findMany.mockResolvedValue([])

    const tree = await fetchGoalTree()
    expect(tree).toHaveLength(1)
    // Weighted: (80*60 + 60*40) / 100 = 72
    expect(tree[0].deptGoals[0].progress).toBe(72)
    expect(tree[0].progress).toBe(72)
  })

  it('falls back to manager rating when no appraisal', async () => {
    mockPrisma.cycle.findFirst.mockResolvedValue({ id: 'c1', name: 'Q1' })
    mockPrisma.orgGoal.findMany.mockResolvedValue([{
      id: 'og1',
      title: 'Goal',
      description: null,
      cycle_id: 'c1',
      creator: { full_name: 'Admin' },
      cycle: { name: 'Q1' },
      dept_goals: [{
        id: 'dg1',
        title: 'Dept Goal',
        description: null,
        department: { name: 'Eng', id: 'd1' },
        creator: { full_name: 'HRBP' },
        kpis: [
          { id: 'k1', title: 'KPI', weight: 100, employee_id: 'e1', cycle_id: 'c1', employee: { full_name: 'Alice' } },
        ],
      }],
    }])
    mockPrisma.appraisal.findMany.mockResolvedValue([])
    mockPrisma.kpi.findMany.mockResolvedValue([
      { id: 'k1', manager_rating: 'EE' },
    ])

    const tree = await fetchGoalTree()
    // EE = 80
    expect(tree[0].deptGoals[0].kpis[0].score).toBe(80)
  })
})

describe('fetchGoalCascadingStats', () => {
  it('counts unlinked KPIs', async () => {
    mockPrisma.cycle.findFirst.mockResolvedValue({ id: 'c1', name: 'Q1' })
    mockPrisma.orgGoal.findMany.mockResolvedValue([])
    mockPrisma.kpi.count.mockResolvedValue(5)

    const stats = await fetchGoalCascadingStats()
    expect(stats.unlinkedKpis).toBe(5)
    expect(stats.totalOrgGoals).toBe(0)
  })
})

describe('CRUD', () => {
  it('creates org goal', async () => {
    mockPrisma.orgGoal.create.mockResolvedValue({ id: 'new' })
    const result = await createOrgGoal({ title: 'Test', createdBy: 'u1' })
    expect(result.id).toBe('new')
  })

  it('links KPI to dept goal', async () => {
    mockPrisma.kpi.update.mockResolvedValue({ id: 'k1', dept_goal_id: 'dg1' })
    const result = await linkKpiToDeptGoal('k1', 'dg1')
    expect(result.dept_goal_id).toBe('dg1')
  })

  it('unlinks KPI', async () => {
    mockPrisma.kpi.update.mockResolvedValue({ id: 'k1', dept_goal_id: null })
    const result = await unlinkKpi('k1')
    expect(result.dept_goal_id).toBeNull()
  })
})
```

**Step 2: Run tests**

```bash
npx vitest run src/lib/__tests__/goal-cascading.test.ts
```

Expected: All tests pass.

**Step 3: Commit**

```bash
git add src/lib/__tests__/goal-cascading.test.ts
git commit -m "test(goal-cascading): add data layer tests for tree, stats, and CRUD"
```

---

### Task 4: Server actions

**Files:**
- Create: `src/app/(dashboard)/admin/goal-cascading/actions.ts`

**Reference files:**
- `src/app/(dashboard)/admin/top-talent/actions.ts` — server action pattern with Zod validation
- `src/app/(dashboard)/shared/kpi-comment-actions.ts` — `getCurrentUser` + role check pattern

**Step 1: Create server actions file**

```typescript
'use server'

import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import {
  createOrgGoal, updateOrgGoal, deleteOrgGoal,
  createDeptGoal, updateDeptGoal, deleteDeptGoal,
  linkKpiToDeptGoal, unlinkKpi,
} from '@/lib/db/goal-cascading'
import { prisma } from '@/lib/prisma'

type ActionResult<T = void> = { success: true; data?: T } | { success: false; error: string }

const orgGoalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  cycleId: z.string().uuid().optional(),
})

const deptGoalSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  orgGoalId: z.string().uuid(),
  departmentId: z.string().uuid(),
})

/* ── Org Goals (admin only) ── */

export async function saveOrgGoal(
  id: string | null,
  formData: { title: string; description?: string; cycleId?: string }
): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (user.role !== 'admin') return { success: false, error: 'Unauthorized' }

  const parsed = orgGoalSchema.safeParse(formData)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  if (id) {
    await updateOrgGoal(id, parsed.data)
  } else {
    await createOrgGoal({ ...parsed.data, createdBy: user.id })
  }

  await prisma.auditLog.create({
    data: {
      user_id: user.id,
      action: id ? 'update_org_goal' : 'create_org_goal',
      entity_type: 'org_goal',
      entity_id: id ?? 'new',
      details: { title: parsed.data.title },
    },
  })

  revalidatePath('/admin/goal-cascading')
  return { success: true }
}

export async function removeOrgGoal(id: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (user.role !== 'admin') return { success: false, error: 'Unauthorized' }

  await deleteOrgGoal(id)

  await prisma.auditLog.create({
    data: {
      user_id: user.id,
      action: 'delete_org_goal',
      entity_type: 'org_goal',
      entity_id: id,
    },
  })

  revalidatePath('/admin/goal-cascading')
  return { success: true }
}

/* ── Dept Goals (admin + hrbp) ── */

export async function saveDeptGoal(
  id: string | null,
  formData: { title: string; description?: string; orgGoalId: string; departmentId: string }
): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!['admin', 'hrbp'].includes(user.role)) return { success: false, error: 'Unauthorized' }

  const parsed = deptGoalSchema.safeParse(formData)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message }

  if (id) {
    await updateDeptGoal(id, { title: parsed.data.title, description: parsed.data.description })
  } else {
    await createDeptGoal({ ...parsed.data, createdBy: user.id })
  }

  await prisma.auditLog.create({
    data: {
      user_id: user.id,
      action: id ? 'update_dept_goal' : 'create_dept_goal',
      entity_type: 'dept_goal',
      entity_id: id ?? 'new',
      details: { title: parsed.data.title },
    },
  })

  revalidatePath('/admin/goal-cascading')
  revalidatePath('/hrbp/goal-cascading')
  return { success: true }
}

export async function removeDeptGoal(id: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!['admin', 'hrbp'].includes(user.role)) return { success: false, error: 'Unauthorized' }

  await deleteDeptGoal(id)

  await prisma.auditLog.create({
    data: {
      user_id: user.id,
      action: 'delete_dept_goal',
      entity_type: 'dept_goal',
      entity_id: id,
    },
  })

  revalidatePath('/admin/goal-cascading')
  revalidatePath('/hrbp/goal-cascading')
  return { success: true }
}

/* ── KPI Linking (manager only) ── */

export async function linkKpi(kpiId: string, deptGoalId: string): Promise<ActionResult> {
  const user = await getCurrentUser()

  // Verify manager owns this KPI
  const kpi = await prisma.kpi.findUnique({
    where: { id: kpiId },
    select: { manager_id: true },
  })
  if (!kpi) return { success: false, error: 'KPI not found' }
  if (kpi.manager_id !== user.id && user.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  await linkKpiToDeptGoal(kpiId, deptGoalId)

  revalidatePath('/manager/goal-cascading')
  revalidatePath('/admin/goal-cascading')
  return { success: true }
}

export async function removeKpiLink(kpiId: string): Promise<ActionResult> {
  const user = await getCurrentUser()

  const kpi = await prisma.kpi.findUnique({
    where: { id: kpiId },
    select: { manager_id: true },
  })
  if (!kpi) return { success: false, error: 'KPI not found' }
  if (kpi.manager_id !== user.id && user.role !== 'admin') {
    return { success: false, error: 'Unauthorized' }
  }

  await unlinkKpi(kpiId)

  revalidatePath('/manager/goal-cascading')
  revalidatePath('/admin/goal-cascading')
  return { success: true }
}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/admin/goal-cascading/actions.ts
git commit -m "feat(goal-cascading): add server actions with Zod validation and audit logging"
```

---

### Task 5: GoalCascadingDashboard client component

**Files:**
- Create: `src/components/goal-cascading-dashboard.tsx`

**Reference files:**
- `src/components/top-talent-dashboard.tsx` — tab structure, glass styling, filter pattern
- `src/components/competency-gap-dashboard.tsx` — similar component from competency gaps task

**Step 1: Create the component**

Large component with:
- **Summary cards** — total org goals, avg completion %, depts on track, unlinked KPIs
- **Tree view** — expandable org goal → dept goals → KPIs with progress bars
- **Admin/HRBP**: Create/edit modals for org goals and dept goals
- **Manager**: KPI linking dropdown

```typescript
'use client'

import { useState, useTransition } from 'react'
import { EmptyState } from '@/components/empty-state'
import {
  Target, ChevronRight, ChevronDown, Plus, Pencil, Trash2,
  Link2, Unlink, AlertCircle,
} from 'lucide-react'
import type { GoalTreeOrgGoal, GoalCascadingStats } from '@/lib/db/goal-cascading'
import {
  saveOrgGoal, removeOrgGoal, saveDeptGoal, removeDeptGoal,
  linkKpi, removeKpiLink,
} from '@/app/(dashboard)/admin/goal-cascading/actions'

interface GoalCascadingDashboardProps {
  role: 'admin' | 'hrbp' | 'manager'
  tree: GoalTreeOrgGoal[]
  stats: GoalCascadingStats
  cycles: Array<{ id: string; name: string }>
  departments: Array<{ id: string; name: string }>
  selectedCycleId: string
  // For manager KPI linking: unlinked KPIs list
  unlinkedKpis?: Array<{ id: string; title: string; employeeName: string }>
  // Available dept goals for linking
  availableDeptGoals?: Array<{ id: string; title: string; department: string }>
}

function ProgressBar({ value, className }: { value: number; className?: string }) {
  const color = value >= 70 ? 'bg-emerald-500' : value >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className={`h-2 rounded-full bg-muted/30 overflow-hidden ${className ?? ''}`}>
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  )
}

export function GoalCascadingDashboard({
  role, tree, stats, cycles, departments, selectedCycleId,
  unlinkedKpis = [], availableDeptGoals = [],
}: GoalCascadingDashboardProps) {
  const [expandedOrg, setExpandedOrg] = useState<Set<string>>(new Set())
  const [expandedDept, setExpandedDept] = useState<Set<string>>(new Set())
  const [showOrgModal, setShowOrgModal] = useState(false)
  const [showDeptModal, setShowDeptModal] = useState<string | null>(null) // org goal id
  const [editingOrg, setEditingOrg] = useState<GoalTreeOrgGoal | null>(null)
  const [isPending, startTransition] = useTransition()

  const isAdmin = role === 'admin'
  const canCreateOrg = isAdmin
  const canCreateDept = role === 'admin' || role === 'hrbp'
  const canLinkKpis = role === 'manager'

  function toggleOrg(id: string) {
    setExpandedOrg(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleDept(id: string) {
    setExpandedDept(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (tree.length === 0 && !canCreateOrg) {
    return <EmptyState icon={Target} title="No goals configured" description="Organization goals have not been set up for this cycle yet." />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Goal Cascading</h1>
        {canCreateOrg && (
          <button
            onClick={() => { setEditingOrg(null); setShowOrgModal(true) }}
            className="glass-accent flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> Org Goal
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="glass p-5 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Org Goals</p>
          <p className="text-2xl font-bold">{stats.totalOrgGoals}</p>
        </div>
        <div className="glass p-5 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Avg Completion</p>
          <p className="text-2xl font-bold">{stats.avgCompletion}%</p>
        </div>
        <div className="glass p-5 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Depts On Track</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.deptsOnTrack}</p>
        </div>
        <div className="glass p-5 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Unlinked KPIs</p>
          <p className="text-2xl font-bold text-amber-400">{stats.unlinkedKpis}</p>
        </div>
      </div>

      {/* Tree view */}
      <div className="space-y-3">
        {tree.map(og => (
          <div key={og.id} className="glass overflow-hidden">
            {/* Org Goal row */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20"
              onClick={() => toggleOrg(og.id)}
            >
              {expandedOrg.has(og.id)
                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Org</span>
                  <span className="font-medium truncate">{og.title}</span>
                </div>
                {og.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{og.description}</p>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold tabular-nums">{og.progress}%</span>
                <ProgressBar value={og.progress} className="w-24" />
                <span className="text-xs text-muted-foreground">{og.deptGoalCount} depts</span>
                {canCreateOrg && (
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditingOrg(og); setShowOrgModal(true) }} className="p-1 hover:bg-muted/30 rounded">
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => startTransition(() => removeOrgGoal(og.id))}
                      className="p-1 hover:bg-red-500/20 rounded"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Dept Goals */}
            {expandedOrg.has(og.id) && (
              <div className="border-t border-border/30">
                {og.deptGoals.map(dg => (
                  <div key={dg.id}>
                    <div
                      className="flex items-center gap-3 pl-10 pr-4 py-2.5 cursor-pointer hover:bg-muted/10"
                      onClick={() => toggleDept(dg.id)}
                    >
                      {expandedDept.has(dg.id)
                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-violet-400">Dept</span>
                          <span className="text-sm font-medium truncate">{dg.title}</span>
                          <span className="text-xs text-muted-foreground">({dg.department})</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold tabular-nums">{dg.progress}%</span>
                        <ProgressBar value={dg.progress} className="w-20" />
                        <span className="text-xs text-muted-foreground">{dg.kpiCount} KPIs</span>
                        {canCreateDept && (
                          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => startTransition(() => removeDeptGoal(dg.id))}
                              className="p-1 hover:bg-red-500/20 rounded"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* KPIs */}
                    {expandedDept.has(dg.id) && dg.kpis.length > 0 && (
                      <div className="border-t border-border/20">
                        {dg.kpis.map(kpi => (
                          <div key={kpi.id} className="flex items-center gap-3 pl-20 pr-4 py-2 text-sm hover:bg-muted/5">
                            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">KPI</span>
                            <span className="flex-1 truncate">{kpi.title}</span>
                            <span className="text-xs text-muted-foreground">{kpi.employeeName}</span>
                            <span className="text-xs font-medium tabular-nums w-12 text-right">
                              {kpi.score != null ? `${kpi.score}%` : '—'}
                            </span>
                            {canLinkKpis && (
                              <button
                                onClick={() => startTransition(() => removeKpiLink(kpi.id))}
                                className="p-1 hover:bg-red-500/20 rounded"
                                title="Unlink KPI"
                              >
                                <Unlink className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Add dept goal button */}
                {canCreateDept && (
                  <button
                    onClick={() => setShowDeptModal(og.id)}
                    className="flex items-center gap-1.5 pl-10 pr-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/10 w-full"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Department Goal
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Unlinked KPIs section (manager only) */}
      {canLinkKpis && unlinkedKpis.length > 0 && (
        <div className="glass p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold">Unlinked KPIs ({unlinkedKpis.length})</h3>
          </div>
          <div className="space-y-2">
            {unlinkedKpis.map(kpi => (
              <div key={kpi.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1">{kpi.title} <span className="text-muted-foreground">— {kpi.employeeName}</span></span>
                <select
                  className="glass-interactive rounded px-2 py-1 text-xs"
                  defaultValue=""
                  onChange={e => {
                    if (e.target.value) startTransition(() => linkKpi(kpi.id, e.target.value))
                  }}
                >
                  <option value="">Link to...</option>
                  {availableDeptGoals.map(dg => (
                    <option key={dg.id} value={dg.id}>{dg.title} ({dg.department})</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Org Goal Modal */}
      {showOrgModal && (
        <GoalModal
          title={editingOrg ? 'Edit Org Goal' : 'New Org Goal'}
          initialTitle={editingOrg?.title ?? ''}
          initialDescription={editingOrg?.description ?? ''}
          cycles={cycles}
          initialCycleId={editingOrg?.cycleId ?? selectedCycleId}
          onSave={(data) => {
            startTransition(async () => {
              await saveOrgGoal(editingOrg?.id ?? null, data)
              setShowOrgModal(false)
            })
          }}
          onClose={() => setShowOrgModal(false)}
        />
      )}

      {/* Dept Goal Modal */}
      {showDeptModal && (
        <DeptGoalModal
          orgGoalId={showDeptModal}
          departments={departments}
          onSave={(data) => {
            startTransition(async () => {
              await saveDeptGoal(null, data)
              setShowDeptModal(null)
            })
          }}
          onClose={() => setShowDeptModal(null)}
        />
      )}
    </div>
  )
}

/* ── Modals ── */

function GoalModal({ title, initialTitle, initialDescription, cycles, initialCycleId, onSave, onClose }: {
  title: string
  initialTitle: string
  initialDescription: string
  cycles: Array<{ id: string; name: string }>
  initialCycleId: string
  onSave: (data: { title: string; description?: string; cycleId?: string }) => void
  onClose: () => void
}) {
  const [goalTitle, setGoalTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [cycleId, setCycleId] = useState(initialCycleId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="glass w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">{title}</h2>
        <input
          value={goalTitle}
          onChange={e => setGoalTitle(e.target.value)}
          placeholder="Goal title"
          className="glass-interactive w-full rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="glass-interactive w-full rounded-lg px-3 py-2 text-sm"
          rows={3}
        />
        <select
          value={cycleId}
          onChange={e => setCycleId(e.target.value)}
          className="glass-interactive w-full rounded-lg px-3 py-2 text-sm"
        >
          <option value="">No cycle</option>
          {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="glass-interactive rounded-lg px-4 py-2 text-sm">Cancel</button>
          <button
            onClick={() => onSave({ title: goalTitle, description: description || undefined, cycleId: cycleId || undefined })}
            disabled={!goalTitle.trim()}
            className="glass-accent rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function DeptGoalModal({ orgGoalId, departments, onSave, onClose }: {
  orgGoalId: string
  departments: Array<{ id: string; name: string }>
  onSave: (data: { title: string; description?: string; orgGoalId: string; departmentId: string }) => void
  onClose: () => void
}) {
  const [goalTitle, setGoalTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deptId, setDeptId] = useState(departments[0]?.id ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="glass w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">New Department Goal</h2>
        <input
          value={goalTitle}
          onChange={e => setGoalTitle(e.target.value)}
          placeholder="Goal title"
          className="glass-interactive w-full rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="glass-interactive w-full rounded-lg px-3 py-2 text-sm"
          rows={3}
        />
        <select
          value={deptId}
          onChange={e => setDeptId(e.target.value)}
          className="glass-interactive w-full rounded-lg px-3 py-2 text-sm"
        >
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="glass-interactive rounded-lg px-4 py-2 text-sm">Cancel</button>
          <button
            onClick={() => onSave({
              title: goalTitle,
              description: description || undefined,
              orgGoalId,
              departmentId: deptId,
            })}
            disabled={!goalTitle.trim() || !deptId}
            className="glass-accent rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/goal-cascading-dashboard.tsx
git commit -m "feat(goal-cascading): add GoalCascadingDashboard component with tree view and modals"
```

---

### Task 6: Route pages (3 routes)

**Files:**
- Create: `src/app/(dashboard)/admin/goal-cascading/page.tsx`
- Create: `src/app/(dashboard)/hrbp/goal-cascading/page.tsx`
- Create: `src/app/(dashboard)/manager/goal-cascading/page.tsx`

**Step 1: Admin route**

```typescript
// src/app/(dashboard)/admin/goal-cascading/page.tsx
import { Suspense } from 'react'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchGoalTree, fetchGoalCascadingStats } from '@/lib/db/goal-cascading'
import { GoalCascadingDashboard } from '@/components/goal-cascading-dashboard'
import { TableSkeleton } from '@/components/skeletons'

async function GoalCascadingContent() {
  await requireRole(['admin'])

  const [publishedCycles, departments] = await Promise.all([
    prisma.cycle.findMany({
      where: { status: 'published' },
      orderBy: { published_at: 'desc' },
      take: 10,
      select: { id: true, name: true },
    }),
    prisma.department.findMany({
      where: { is_active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const latestCycleId = publishedCycles[0]?.id
  const [tree, stats] = await Promise.all([
    fetchGoalTree({ cycleId: latestCycleId }),
    fetchGoalCascadingStats({ cycleId: latestCycleId }),
  ])

  return (
    <GoalCascadingDashboard
      role="admin"
      tree={tree}
      stats={stats}
      cycles={publishedCycles}
      departments={departments}
      selectedCycleId={latestCycleId ?? ''}
    />
  )
}

export default function AdminGoalCascadingPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <GoalCascadingContent />
    </Suspense>
  )
}
```

**Step 2: HRBP route**

```typescript
// src/app/(dashboard)/hrbp/goal-cascading/page.tsx
import { Suspense } from 'react'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchGoalTree, fetchGoalCascadingStats } from '@/lib/db/goal-cascading'
import { GoalCascadingDashboard } from '@/components/goal-cascading-dashboard'
import { TableSkeleton } from '@/components/skeletons'

async function GoalCascadingContent() {
  await requireRole(['hrbp'])

  const [publishedCycles, departments] = await Promise.all([
    prisma.cycle.findMany({
      where: { status: 'published' },
      orderBy: { published_at: 'desc' },
      take: 10,
      select: { id: true, name: true },
    }),
    prisma.department.findMany({
      where: { is_active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const latestCycleId = publishedCycles[0]?.id
  const [tree, stats] = await Promise.all([
    fetchGoalTree({ cycleId: latestCycleId }),
    fetchGoalCascadingStats({ cycleId: latestCycleId }),
  ])

  return (
    <GoalCascadingDashboard
      role="hrbp"
      tree={tree}
      stats={stats}
      cycles={publishedCycles}
      departments={departments}
      selectedCycleId={latestCycleId ?? ''}
    />
  )
}

export default function HrbpGoalCascadingPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <GoalCascadingContent />
    </Suspense>
  )
}
```

**Step 3: Manager route (scoped + KPI linking)**

```typescript
// src/app/(dashboard)/manager/goal-cascading/page.tsx
import { Suspense } from 'react'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchGoalTree, fetchGoalCascadingStats } from '@/lib/db/goal-cascading'
import { GoalCascadingDashboard } from '@/components/goal-cascading-dashboard'
import { TableSkeleton } from '@/components/skeletons'

async function GoalCascadingContent() {
  const user = await requireRole(['manager'])

  const publishedCycles = await prisma.cycle.findMany({
    where: { status: 'published' },
    orderBy: { published_at: 'desc' },
    take: 10,
    select: { id: true, name: true },
  })

  const latestCycleId = publishedCycles[0]?.id
  const opts = { managerId: user.id, cycleId: latestCycleId }

  const [tree, stats] = await Promise.all([
    fetchGoalTree(opts),
    fetchGoalCascadingStats(opts),
  ])

  // Unlinked KPIs for this manager's team
  const unlinkedKpis = latestCycleId
    ? await prisma.kpi.findMany({
        where: { cycle_id: latestCycleId, manager_id: user.id, dept_goal_id: null },
        select: {
          id: true,
          title: true,
          employee: { select: { full_name: true } },
        },
      })
    : []

  // Available dept goals for linking
  const availableDeptGoals = latestCycleId
    ? await prisma.deptGoal.findMany({
        where: { org_goal: { cycle_id: latestCycleId } },
        select: {
          id: true,
          title: true,
          department: { select: { name: true } },
        },
      })
    : []

  return (
    <GoalCascadingDashboard
      role="manager"
      tree={tree}
      stats={stats}
      cycles={publishedCycles}
      departments={[]}
      selectedCycleId={latestCycleId ?? ''}
      unlinkedKpis={unlinkedKpis.map(k => ({
        id: k.id,
        title: k.title,
        employeeName: k.employee?.full_name ?? '',
      }))}
      availableDeptGoals={availableDeptGoals.map(dg => ({
        id: dg.id,
        title: dg.title,
        department: dg.department?.name ?? '',
      }))}
    />
  )
}

export default function ManagerGoalCascadingPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <GoalCascadingContent />
    </Suspense>
  )
}
```

**Step 4: Commit**

```bash
git add src/app/(dashboard)/admin/goal-cascading/page.tsx src/app/(dashboard)/hrbp/goal-cascading/page.tsx src/app/(dashboard)/manager/goal-cascading/page.tsx
git commit -m "feat(goal-cascading): add admin, hrbp, and manager route pages"
```

---

### Task 7: Sidebar nav links

**Files:**
- Modify: `src/components/sidebar.tsx`

**Step 1: Add nav items**

In the `NAV_ITEMS` object, add after each role's "Competency Gaps" entry (or after "Top Talent" if competency gaps isn't added yet):

- **admin** (after Top Talent / Competency Gaps):
  ```typescript
  { label: 'Goal Cascading',  href: '/admin/goal-cascading',  icon: Target },
  ```

- **hrbp** (after Top Talent / Competency Gaps):
  ```typescript
  { label: 'Goal Cascading',  href: '/hrbp/goal-cascading',  icon: Target },
  ```

- **manager** (after Top Talent / Competency Gaps):
  ```typescript
  { label: 'Goal Cascading',  href: '/manager/goal-cascading', icon: Target },
  ```

Note: `Target` icon is already imported in sidebar.tsx.

**Step 2: Commit**

```bash
git add src/components/sidebar.tsx
git commit -m "feat(goal-cascading): add sidebar nav links for all roles"
```

---

### Task 8: Type check and verify

**Step 1: Run TypeScript compiler**

```bash
npx tsc --noEmit
```

Fix any type errors.

**Step 2: Run all tests**

```bash
npx vitest run
```

Ensure all existing + new tests pass.

**Step 3: Final commit (if fixes needed)**

```bash
git add -A
git commit -m "fix(goal-cascading): resolve type errors and test fixes"
```
