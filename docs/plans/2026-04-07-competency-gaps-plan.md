# Competency Gap Report — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a competency gap report showing where employees need development, with heatmap, radar chart, trend lines, sortable table, and CSV export.

**Architecture:** Query-time aggregation from existing `review_responses` data — no schema changes. Single client component `CompetencyGapDashboard` with `role` prop, served from 3 role-scoped route pages. Data layer in `src/lib/db/competency-gaps.ts`.

**Tech Stack:** Next.js 16, React 19, Prisma 7, Recharts, Tailwind v4, Vitest

---

### Task 1: Data Layer — competency gap queries

**Files:**
- Create: `src/lib/db/competency-gaps.ts`

**Reference files (read before starting):**
- `src/lib/db/top-talent.ts` — query pattern (resolve cycle → batch fetch → build maps → compute)
- `src/lib/score-engine.ts:1-15` — `calculateCompetencyScore` (rating × 20, average)
- `prisma/schema.prisma` — `Competency`, `ReviewQuestion`, `ReviewResponse`, `Review`, `Appraisal` models

**Step 1: Create `src/lib/db/competency-gaps.ts` with types and exports**

```typescript
import { prisma } from '@/lib/prisma'

/* ── Types ── */

export interface CompetencyGapRow {
  employeeId: string
  employeeName: string
  department: string
  competencyScores: Record<string, number | null> // competencyId → avg rating (1-5)
}

export interface CompetencyMeta {
  id: string
  name: string
  category: string // core, functional, leadership
}

export interface CompetencyGapStats {
  competencies: CompetencyMeta[]
  overallAvg: Record<string, number> // competencyId → org-wide avg rating
  deptAvg: Record<string, Record<string, number>> // deptName → competencyId → avg
  lowestCompetency: { name: string; avg: number } | null
  lowestDept: { name: string; avg: number } | null
  overallScore: number
}

export interface CompetencyTrendPoint {
  cycleName: string
  cycleId: string
  averages: Record<string, number> // competencyId → avg rating
}
```

**Step 2: Implement `fetchCompetencyGapData`**

This is the main query — per-employee per-competency manager ratings for a given cycle.

```typescript
export async function fetchCompetencyGapData(
  cycleId: string,
  options?: { managerId?: string; departmentId?: string }
): Promise<{ rows: CompetencyGapRow[]; competencies: CompetencyMeta[] }> {
  // 1. Get active competencies
  const competencies = await prisma.competency.findMany({
    where: { is_active: true },
    orderBy: [{ category: 'asc' }, { sort_order: 'asc' }],
    select: { id: true, name: true, category: true },
  })

  if (competencies.length === 0) return { rows: [], competencies: [] }

  // 2. Get the cycle's review template to find competency-linked questions
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: { review_template_id: true },
  })
  if (!cycle?.review_template_id) return { rows: [], competencies }

  const questions = await prisma.reviewQuestion.findMany({
    where: {
      template_id: cycle.review_template_id,
      competency_id: { not: null },
      answer_type: 'rating',
    },
    select: { id: true, competency_id: true },
  })

  if (questions.length === 0) return { rows: [], competencies }

  // Map: questionId → competencyId
  const questionCompMap = new Map(questions.map(q => [q.id, q.competency_id!]))
  const questionIds = questions.map(q => q.id)

  // 3. Build employee filter
  const employeeWhere: any = { is_active: true }
  if (options?.managerId) employeeWhere.manager_id = options.managerId
  if (options?.departmentId) employeeWhere.department_id = options.departmentId

  // 4. Get reviews for this cycle (we want manager responses)
  const reviews = await prisma.review.findMany({
    where: {
      cycle_id: cycleId,
      employee: employeeWhere,
    },
    select: {
      id: true,
      employee_id: true,
      employee: {
        select: {
          id: true,
          full_name: true,
          department: { select: { name: true } },
        },
      },
    },
  })

  if (reviews.length === 0) return { rows: [], competencies }

  const reviewIds = reviews.map(r => r.id)

  // 5. Get manager responses (respondent is manager, not self)
  // Manager responses: respondent_id != employee_id
  const responses = await prisma.reviewResponse.findMany({
    where: {
      review_id: { in: reviewIds },
      question_id: { in: questionIds },
      rating_value: { not: null },
    },
    select: {
      review_id: true,
      question_id: true,
      respondent_id: true,
      rating_value: true,
    },
  })

  // Build review → employee map
  const reviewEmployeeMap = new Map(reviews.map(r => [r.id, r]))

  // 6. Aggregate: per employee, per competency → average manager rating
  // Group responses by employee+competency
  const empCompRatings = new Map<string, Map<string, number[]>>()

  for (const resp of responses) {
    const review = reviewEmployeeMap.get(resp.review_id)
    if (!review) continue

    // Only manager responses (respondent != employee)
    if (resp.respondent_id === review.employee_id) continue

    const empId = review.employee_id
    const compId = questionCompMap.get(resp.question_id)
    if (!compId) continue

    if (!empCompRatings.has(empId)) empCompRatings.set(empId, new Map())
    const compMap = empCompRatings.get(empId)!
    if (!compMap.has(compId)) compMap.set(compId, [])
    compMap.get(compId)!.push(resp.rating_value!)
  }

  // 7. Build rows
  const rows: CompetencyGapRow[] = reviews
    .filter(r => empCompRatings.has(r.employee_id))
    .map(r => {
      const compMap = empCompRatings.get(r.employee_id)!
      const competencyScores: Record<string, number | null> = {}

      for (const comp of competencies) {
        const ratings = compMap.get(comp.id)
        if (ratings && ratings.length > 0) {
          competencyScores[comp.id] = Math.round(
            (ratings.reduce((s, v) => s + v, 0) / ratings.length) * 100
          ) / 100
        } else {
          competencyScores[comp.id] = null
        }
      }

      return {
        employeeId: r.employee_id,
        employeeName: r.employee?.full_name ?? '',
        department: r.employee?.department?.name ?? '-',
        competencyScores,
      }
    })

  return { rows, competencies }
}
```

**Step 3: Implement `fetchCompetencyGapStats`**

```typescript
export async function fetchCompetencyGapStats(
  cycleId: string,
  options?: { managerId?: string; departmentId?: string }
): Promise<CompetencyGapStats> {
  const { rows, competencies } = await fetchCompetencyGapData(cycleId, options)

  // Overall avg per competency
  const overallAvg: Record<string, number> = {}
  for (const comp of competencies) {
    const vals = rows.map(r => r.competencyScores[comp.id]).filter((v): v is number => v != null)
    overallAvg[comp.id] = vals.length > 0
      ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100
      : 0
  }

  // Dept avg per competency
  const deptGroups = new Map<string, CompetencyGapRow[]>()
  for (const row of rows) {
    const arr = deptGroups.get(row.department) ?? []
    arr.push(row)
    deptGroups.set(row.department, arr)
  }

  const deptAvg: Record<string, Record<string, number>> = {}
  for (const [dept, deptRows] of deptGroups) {
    deptAvg[dept] = {}
    for (const comp of competencies) {
      const vals = deptRows.map(r => r.competencyScores[comp.id]).filter((v): v is number => v != null)
      deptAvg[dept][comp.id] = vals.length > 0
        ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100
        : 0
    }
  }

  // Lowest competency
  const compEntries = Object.entries(overallAvg).filter(([, v]) => v > 0)
  const lowestComp = compEntries.length > 0
    ? compEntries.reduce((min, [id, v]) => (v < min[1] ? [id, v] : min))
    : null
  const lowestCompetency = lowestComp
    ? { name: competencies.find(c => c.id === lowestComp[0])?.name ?? '', avg: lowestComp[1] }
    : null

  // Lowest dept (avg across all competencies)
  const deptScores = Object.entries(deptAvg).map(([dept, scores]) => {
    const vals = Object.values(scores).filter(v => v > 0)
    return { name: dept, avg: vals.length > 0 ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100 : 0 }
  })
  const lowestDept = deptScores.length > 0
    ? deptScores.reduce((min, d) => (d.avg > 0 && d.avg < min.avg ? d : min), deptScores[0])
    : null

  // Overall score
  const allVals = Object.values(overallAvg).filter(v => v > 0)
  const overallScore = allVals.length > 0
    ? Math.round((allVals.reduce((s, v) => s + v, 0) / allVals.length) * 100) / 100
    : 0

  return {
    competencies,
    overallAvg,
    deptAvg,
    lowestCompetency,
    lowestDept: lowestDept?.avg ? lowestDept : null,
    overallScore,
  }
}
```

**Step 4: Implement `fetchCompetencyTrends`**

```typescript
export async function fetchCompetencyTrends(
  competencyIds: string[],
  options?: { managerId?: string; departmentId?: string }
): Promise<CompetencyTrendPoint[]> {
  // Get last 5 published cycles
  const cycles = await prisma.cycle.findMany({
    where: { status: 'published' },
    orderBy: { published_at: 'desc' },
    take: 5,
    select: { id: true, name: true, review_template_id: true },
  })

  if (cycles.length === 0) return []

  const points: CompetencyTrendPoint[] = []

  for (const cycle of [...cycles].reverse()) {
    if (!cycle.review_template_id) continue
    const { rows, competencies } = await fetchCompetencyGapData(cycle.id, options)

    const averages: Record<string, number> = {}
    for (const compId of competencyIds) {
      const vals = rows.map(r => r.competencyScores[compId]).filter((v): v is number => v != null)
      averages[compId] = vals.length > 0
        ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100
        : 0
    }

    points.push({ cycleName: cycle.name, cycleId: cycle.id, averages })
  }

  return points
}
```

**Step 5: Commit**

```bash
git add src/lib/db/competency-gaps.ts
git commit -m "feat(competency-gaps): add data layer with gap queries, stats, and trends"
```

---

### Task 2: Tests — competency gap data layer

**Files:**
- Create: `src/lib/__tests__/competency-gaps.test.ts`

**Reference files:**
- `src/lib/__tests__/top-talent.test.ts` — mock pattern (vi.mock prisma before imports)

**Step 1: Write test file with mocks and helpers**

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    competency: { findMany: vi.fn() },
    cycle: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    reviewQuestion: { findMany: vi.fn() },
    review: { findMany: vi.fn() },
    reviewResponse: { findMany: vi.fn() },
    user: { count: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import {
  fetchCompetencyGapData,
  fetchCompetencyGapStats,
  fetchCompetencyTrends,
} from '@/lib/db/competency-gaps'

const mockPrisma = prisma as any

const COMPETENCIES = [
  { id: 'comp-1', name: 'Communication', category: 'core' },
  { id: 'comp-2', name: 'Leadership', category: 'leadership' },
]

const QUESTIONS = [
  { id: 'q-1', competency_id: 'comp-1' },
  { id: 'q-2', competency_id: 'comp-2' },
]

function makeReview(empId: string, empName: string, dept: string) {
  return {
    id: `review-${empId}`,
    employee_id: empId,
    employee: {
      id: empId,
      full_name: empName,
      department: { name: dept },
    },
  }
}

function makeResponse(reviewId: string, questionId: string, respondentId: string, rating: number) {
  return {
    review_id: reviewId,
    question_id: questionId,
    respondent_id: respondentId,
    rating_value: rating,
  }
}

beforeEach(() => vi.clearAllMocks())
```

**Step 2: Add test suites**

```typescript
describe('fetchCompetencyGapData', () => {
  it('returns empty when no competencies', async () => {
    mockPrisma.competency.findMany.mockResolvedValue([])
    const result = await fetchCompetencyGapData('cycle-1')
    expect(result.rows).toEqual([])
  })

  it('returns empty when cycle has no review template', async () => {
    mockPrisma.competency.findMany.mockResolvedValue(COMPETENCIES)
    mockPrisma.cycle.findUnique.mockResolvedValue({ review_template_id: null })
    const result = await fetchCompetencyGapData('cycle-1')
    expect(result.rows).toEqual([])
  })

  it('computes per-employee per-competency averages from manager ratings only', async () => {
    mockPrisma.competency.findMany.mockResolvedValue(COMPETENCIES)
    mockPrisma.cycle.findUnique.mockResolvedValue({ review_template_id: 'tmpl-1' })
    mockPrisma.reviewQuestion.findMany.mockResolvedValue(QUESTIONS)
    mockPrisma.review.findMany.mockResolvedValue([
      makeReview('emp-1', 'Alice', 'Engineering'),
    ])
    mockPrisma.reviewResponse.findMany.mockResolvedValue([
      // Manager response (respondent != employee)
      makeResponse('review-emp-1', 'q-1', 'mgr-1', 4),
      makeResponse('review-emp-1', 'q-2', 'mgr-1', 3),
      // Self-response (should be excluded)
      makeResponse('review-emp-1', 'q-1', 'emp-1', 5),
    ])

    const result = await fetchCompetencyGapData('cycle-1')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].competencyScores['comp-1']).toBe(4)
    expect(result.rows[0].competencyScores['comp-2']).toBe(3)
  })

  it('filters by managerId when provided', async () => {
    mockPrisma.competency.findMany.mockResolvedValue(COMPETENCIES)
    mockPrisma.cycle.findUnique.mockResolvedValue({ review_template_id: 'tmpl-1' })
    mockPrisma.reviewQuestion.findMany.mockResolvedValue(QUESTIONS)
    mockPrisma.review.findMany.mockResolvedValue([])
    mockPrisma.reviewResponse.findMany.mockResolvedValue([])

    await fetchCompetencyGapData('cycle-1', { managerId: 'mgr-1' })

    const reviewCall = mockPrisma.review.findMany.mock.calls[0][0]
    expect(reviewCall.where.employee.manager_id).toBe('mgr-1')
  })
})

describe('fetchCompetencyGapStats', () => {
  it('computes overall and dept averages', async () => {
    mockPrisma.competency.findMany.mockResolvedValue(COMPETENCIES)
    mockPrisma.cycle.findUnique.mockResolvedValue({ review_template_id: 'tmpl-1' })
    mockPrisma.reviewQuestion.findMany.mockResolvedValue(QUESTIONS)
    mockPrisma.review.findMany.mockResolvedValue([
      makeReview('emp-1', 'Alice', 'Engineering'),
      makeReview('emp-2', 'Bob', 'Design'),
    ])
    mockPrisma.reviewResponse.findMany.mockResolvedValue([
      makeResponse('review-emp-1', 'q-1', 'mgr-1', 4),
      makeResponse('review-emp-1', 'q-2', 'mgr-1', 2),
      makeResponse('review-emp-2', 'q-1', 'mgr-2', 3),
      makeResponse('review-emp-2', 'q-2', 'mgr-2', 4),
    ])

    const stats = await fetchCompetencyGapStats('cycle-1')

    // Communication: (4+3)/2 = 3.5
    expect(stats.overallAvg['comp-1']).toBe(3.5)
    // Leadership: (2+4)/2 = 3
    expect(stats.overallAvg['comp-2']).toBe(3)
    // Lowest competency is Leadership
    expect(stats.lowestCompetency?.name).toBe('Leadership')
    // Dept avgs exist
    expect(stats.deptAvg['Engineering']['comp-1']).toBe(4)
    expect(stats.deptAvg['Design']['comp-1']).toBe(3)
  })
})

describe('fetchCompetencyTrends', () => {
  it('returns trend points across published cycles', async () => {
    mockPrisma.cycle.findMany.mockResolvedValue([
      { id: 'c2', name: 'Q2', review_template_id: 'tmpl-1' },
      { id: 'c1', name: 'Q1', review_template_id: 'tmpl-1' },
    ])
    // Each fetchCompetencyGapData call will need mocks
    mockPrisma.competency.findMany.mockResolvedValue(COMPETENCIES)
    mockPrisma.cycle.findUnique.mockResolvedValue({ review_template_id: 'tmpl-1' })
    mockPrisma.reviewQuestion.findMany.mockResolvedValue(QUESTIONS)
    mockPrisma.review.findMany.mockResolvedValue([
      makeReview('emp-1', 'Alice', 'Engineering'),
    ])
    mockPrisma.reviewResponse.findMany.mockResolvedValue([
      makeResponse('review-emp-1', 'q-1', 'mgr-1', 4),
      makeResponse('review-emp-1', 'q-2', 'mgr-1', 3),
    ])

    const trends = await fetchCompetencyTrends(['comp-1', 'comp-2'])
    expect(trends).toHaveLength(2)
    expect(trends[0].cycleName).toBe('Q1') // chronological order
    expect(trends[0].averages['comp-1']).toBe(4)
  })
})
```

**Step 3: Run tests**

```bash
npx vitest run src/lib/__tests__/competency-gaps.test.ts
```

Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/lib/__tests__/competency-gaps.test.ts
git commit -m "test(competency-gaps): add data layer tests for gaps, stats, and trends"
```

---

### Task 3: CompetencyGapDashboard client component

**Files:**
- Create: `src/components/competency-gap-dashboard.tsx`

**Reference files:**
- `src/components/top-talent-dashboard.tsx` — tab structure, glass styling, filter pattern, CSV export
- `src/components/report-charts.tsx` — Recharts patterns, color palettes, tooltip styles
- `src/lib/csv-export.ts` — `downloadCsv()` usage

**Step 1: Create the component with types, tabs, and filters**

The component receives pre-fetched data from the server page. It has 4 tabs: Overview, Heatmap, Trends, Employees.

```typescript
'use client'

import { useState, useMemo } from 'react'
import { downloadCsv } from '@/lib/csv-export'
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import { EmptyState } from '@/components/empty-state'
import { BarChart3, TrendingUp, Users2, FileDown, Grid3X3 } from 'lucide-react'
import type {
  CompetencyGapRow, CompetencyMeta, CompetencyGapStats, CompetencyTrendPoint,
} from '@/lib/db/competency-gaps'

/* ── Color helpers ── */

function ratingColor(rating: number): string {
  if (rating >= 4) return 'bg-emerald-500/70 text-white'
  if (rating >= 3) return 'bg-amber-500/70 text-white'
  return 'bg-red-500/70 text-white'
}

function ratingBgHex(rating: number): string {
  if (rating >= 4) return '#34d399'
  if (rating >= 3) return '#fbbf24'
  return '#f87171'
}

const LINE_COLORS = [
  '#818cf8', '#34d399', '#f472b6', '#facc15', '#60a5fa',
  '#a78bfa', '#fb923c', '#22d3ee', '#e879f9', '#4ade80',
]

const TOOLTIP_STYLE = {
  contentStyle: {
    background: 'rgba(15, 23, 42, 0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#e2e8f0',
  },
  labelStyle: { color: '#94a3b8', fontWeight: 600, marginBottom: 4 },
}

type Tab = 'overview' | 'heatmap' | 'trends' | 'employees'

interface CompetencyGapDashboardProps {
  role: 'admin' | 'hrbp' | 'manager'
  rows: CompetencyGapRow[]
  stats: CompetencyGapStats
  trends: CompetencyTrendPoint[]
  cycles: Array<{ id: string; name: string }>
  selectedCycleId: string
  departments: string[]
}
```

**Step 2: Implement the component body**

Key sections:
- **Tab bar** — overview, heatmap, trends, employees
- **Filters** — department dropdown (admin/hrbp only), competency category
- **Overview tab**: 3 summary cards + radar chart (org-wide competency profile)
- **Heatmap tab**: Rows = departments (admin/hrbp) or employees (manager), Columns = competencies, Cells = colored by rating
- **Trends tab**: Multi-cycle line chart with one line per competency
- **Employees tab**: Sortable table with competency columns + CSV export button

```typescript
export function CompetencyGapDashboard({
  role, rows, stats, trends, cycles, selectedCycleId, departments,
}: CompetencyGapDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [deptFilter, setDeptFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const isManager = role === 'manager'

  /* ── Filtered data ── */
  const filteredRows = useMemo(() => {
    let result = rows
    if (deptFilter !== 'all') result = result.filter(r => r.department === deptFilter)
    return result
  }, [rows, deptFilter])

  const filteredCompetencies = useMemo(() => {
    if (categoryFilter === 'all') return stats.competencies
    return stats.competencies.filter(c => c.category === categoryFilter)
  }, [stats.competencies, categoryFilter])

  const categories = useMemo(() => {
    const cats = new Set(stats.competencies.map(c => c.category))
    return Array.from(cats).sort()
  }, [stats.competencies])

  /* ── Radar data ── */
  const radarData = useMemo(() =>
    filteredCompetencies.map(c => ({
      competency: c.name,
      score: stats.overallAvg[c.id] ?? 0,
      fullMark: 5,
    })),
    [filteredCompetencies, stats.overallAvg]
  )

  /* ── Trend data ── */
  const trendData = useMemo(() =>
    trends.map(t => {
      const point: Record<string, string | number> = { cycle: t.cycleName }
      for (const c of filteredCompetencies) {
        point[c.name] = t.averages[c.id] ?? 0
      }
      return point
    }),
    [trends, filteredCompetencies]
  )

  /* ── Heatmap data (dept-level for admin/hrbp, employee-level for manager) ── */
  const heatmapRows = useMemo(() => {
    if (isManager) {
      // Employee-level
      return filteredRows.map(r => ({
        label: r.employeeName,
        scores: filteredCompetencies.map(c => r.competencyScores[c.id] ?? null),
      }))
    }
    // Dept-level
    const deptNames = deptFilter !== 'all' ? [deptFilter] : departments
    return deptNames.map(dept => ({
      label: dept,
      scores: filteredCompetencies.map(c => stats.deptAvg[dept]?.[c.id] ?? null),
    }))
  }, [isManager, filteredRows, filteredCompetencies, departments, deptFilter, stats.deptAvg])

  /* ── CSV export ── */
  function handleExport() {
    const csvRows = filteredRows.map(r => {
      const row: Record<string, string | number> = {
        Employee: r.employeeName,
        Department: r.department,
      }
      for (const c of filteredCompetencies) {
        row[c.name] = r.competencyScores[c.id] ?? ''
      }
      return row
    })
    downloadCsv(csvRows, `competency-gaps-${selectedCycleId}.csv`)
  }

  if (stats.competencies.length === 0) {
    return <EmptyState icon={BarChart3} title="No competency data" description="No competencies have been configured or no reviews completed for the selected cycle." />
  }

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'heatmap', label: 'Heatmap', icon: Grid3X3 },
    { key: 'trends', label: 'Trends', icon: TrendingUp },
    { key: 'employees', label: 'Employees', icon: Users2 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Competency Gaps</h1>
        <div className="flex items-center gap-2">
          {/* Department filter (admin/hrbp only) */}
          {!isManager && departments.length > 1 && (
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="glass-interactive rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          {/* Category filter */}
          {categories.length > 1 && (
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="glass-interactive rounded-lg px-3 py-1.5 text-sm"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          )}
          <button onClick={handleExport} className="glass-interactive flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm">
            <FileDown className="h-4 w-4" /> CSV
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-muted/30 p-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="glass p-5 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Overall Avg</p>
              <p className="text-2xl font-bold">{stats.overallScore.toFixed(1)}<span className="text-sm text-muted-foreground">/5</span></p>
            </div>
            <div className="glass p-5 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Weakest Competency</p>
              <p className="text-lg font-semibold">{stats.lowestCompetency?.name ?? '—'}</p>
              {stats.lowestCompetency && <p className="text-sm text-muted-foreground">{stats.lowestCompetency.avg.toFixed(1)} avg</p>}
            </div>
            <div className="glass p-5 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Weakest Department</p>
              <p className="text-lg font-semibold">{stats.lowestDept?.name ?? '—'}</p>
              {stats.lowestDept && <p className="text-sm text-muted-foreground">{stats.lowestDept.avg.toFixed(1)} avg</p>}
            </div>
          </div>

          {/* Radar chart */}
          {radarData.length > 0 && (
            <div className="glass p-5">
              <h3 className="text-sm font-semibold mb-4">Competency Profile</h3>
              <ResponsiveContainer width="100%" height={350}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="competency" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 5]} tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Radar name="Avg Rating" dataKey="score" stroke="#818cf8" fill="#818cf8" fillOpacity={0.3} />
                  <Tooltip {...TOOLTIP_STYLE} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Heatmap Tab ── */}
      {activeTab === 'heatmap' && (
        <div className="glass overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="sticky left-0 bg-background/80 backdrop-blur px-4 py-3 text-left font-medium text-muted-foreground">
                  {isManager ? 'Employee' : 'Department'}
                </th>
                {filteredCompetencies.map(c => (
                  <th key={c.id} className="px-3 py-3 text-center font-medium text-muted-foreground whitespace-nowrap">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapRows.map((row, i) => (
                <tr key={i} className="border-b border-border/30">
                  <td className="sticky left-0 bg-background/80 backdrop-blur px-4 py-2.5 font-medium">
                    {row.label}
                  </td>
                  {row.scores.map((score, j) => (
                    <td key={j} className="px-3 py-2.5 text-center">
                      {score != null ? (
                        <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${ratingColor(score)}`}>
                          {score.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Trends Tab ── */}
      {activeTab === 'trends' && (
        <div className="glass p-5">
          <h3 className="text-sm font-semibold mb-4">Competency Trends Across Cycles</h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="cycle" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis domain={[0, 5]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend />
                {filteredCompetencies.map((c, i) => (
                  <Line
                    key={c.id}
                    type="monotone"
                    dataKey={c.name}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">No trend data available. At least 2 published cycles required.</p>
          )}
        </div>
      )}

      {/* ── Employees Tab ── */}
      {activeTab === 'employees' && (
        <div className="glass overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="sticky left-0 bg-background/80 backdrop-blur px-4 py-3 text-left font-medium text-muted-foreground">Employee</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Department</th>
                {filteredCompetencies.map(c => (
                  <th key={c.id} className="px-3 py-3 text-center font-medium text-muted-foreground whitespace-nowrap">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(row => (
                <tr key={row.employeeId} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="sticky left-0 bg-background/80 backdrop-blur px-4 py-2.5 font-medium">{row.employeeName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{row.department}</td>
                  {filteredCompetencies.map(c => (
                    <td key={c.id} className="px-3 py-2.5 text-center">
                      {row.competencyScores[c.id] != null ? (
                        <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${ratingColor(row.competencyScores[c.id]!)}`}>
                          {row.competencyScores[c.id]!.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr><td colSpan={filteredCompetencies.length + 2} className="px-4 py-8 text-center text-muted-foreground">No data for selected filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/components/competency-gap-dashboard.tsx
git commit -m "feat(competency-gaps): add CompetencyGapDashboard client component with heatmap, radar, trends, table"
```

---

### Task 4: Route pages (3 routes)

**Files:**
- Create: `src/app/(dashboard)/admin/competency-gaps/page.tsx`
- Create: `src/app/(dashboard)/hrbp/competency-gaps/page.tsx`
- Create: `src/app/(dashboard)/manager/competency-gaps/page.tsx`

**Reference files:**
- `src/app/(dashboard)/admin/top-talent/page.tsx` — Suspense + requireRole + data fetching pattern

**Step 1: Create admin route**

```typescript
// src/app/(dashboard)/admin/competency-gaps/page.tsx
import { Suspense } from 'react'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchCompetencyGapData, fetchCompetencyGapStats, fetchCompetencyTrends } from '@/lib/db/competency-gaps'
import { CompetencyGapDashboard } from '@/components/competency-gap-dashboard'
import { TableSkeleton } from '@/components/skeletons'

async function CompetencyGapContent() {
  await requireRole(['admin'])

  const publishedCycles = await prisma.cycle.findMany({
    where: { status: 'published' },
    orderBy: { published_at: 'desc' },
    take: 10,
    select: { id: true, name: true },
  })

  const latestCycleId = publishedCycles[0]?.id
  if (!latestCycleId) {
    const { CompetencyGapDashboard: Dash } = await import('@/components/competency-gap-dashboard')
    return <Dash role="admin" rows={[]} stats={{ competencies: [], overallAvg: {}, deptAvg: {}, lowestCompetency: null, lowestDept: null, overallScore: 0 }} trends={[]} cycles={[]} selectedCycleId="" departments={[]} />
  }

  const [{ rows, competencies }, stats, trends] = await Promise.all([
    fetchCompetencyGapData(latestCycleId),
    fetchCompetencyGapStats(latestCycleId),
    fetchCompetencyTrends(
      (await prisma.competency.findMany({ where: { is_active: true }, select: { id: true } })).map(c => c.id)
    ),
  ])

  const departments = await prisma.department.findMany({
    where: { is_active: true },
    select: { name: true },
    orderBy: { name: 'asc' },
  })

  return (
    <CompetencyGapDashboard
      role="admin"
      rows={rows}
      stats={stats}
      trends={trends}
      cycles={publishedCycles}
      selectedCycleId={latestCycleId}
      departments={departments.map(d => d.name)}
    />
  )
}

export default function AdminCompetencyGapsPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <CompetencyGapContent />
    </Suspense>
  )
}
```

**Step 2: Create HRBP route (identical except role)**

```typescript
// src/app/(dashboard)/hrbp/competency-gaps/page.tsx
import { Suspense } from 'react'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchCompetencyGapData, fetchCompetencyGapStats, fetchCompetencyTrends } from '@/lib/db/competency-gaps'
import { CompetencyGapDashboard } from '@/components/competency-gap-dashboard'
import { TableSkeleton } from '@/components/skeletons'

async function CompetencyGapContent() {
  await requireRole(['hrbp'])

  const publishedCycles = await prisma.cycle.findMany({
    where: { status: 'published' },
    orderBy: { published_at: 'desc' },
    take: 10,
    select: { id: true, name: true },
  })

  const latestCycleId = publishedCycles[0]?.id
  if (!latestCycleId) {
    return <CompetencyGapDashboard role="hrbp" rows={[]} stats={{ competencies: [], overallAvg: {}, deptAvg: {}, lowestCompetency: null, lowestDept: null, overallScore: 0 }} trends={[]} cycles={[]} selectedCycleId="" departments={[]} />
  }

  const [{ rows }, stats, trends, departments] = await Promise.all([
    fetchCompetencyGapData(latestCycleId),
    fetchCompetencyGapStats(latestCycleId),
    fetchCompetencyTrends(
      (await prisma.competency.findMany({ where: { is_active: true }, select: { id: true } })).map(c => c.id)
    ),
    prisma.department.findMany({ where: { is_active: true }, select: { name: true }, orderBy: { name: 'asc' } }),
  ])

  return (
    <CompetencyGapDashboard
      role="hrbp"
      rows={rows}
      stats={stats}
      trends={trends}
      cycles={publishedCycles}
      selectedCycleId={latestCycleId}
      departments={departments.map(d => d.name)}
    />
  )
}

export default function HrbpCompetencyGapsPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <CompetencyGapContent />
    </Suspense>
  )
}
```

**Step 3: Create manager route (scoped to direct reports)**

```typescript
// src/app/(dashboard)/manager/competency-gaps/page.tsx
import { Suspense } from 'react'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchCompetencyGapData, fetchCompetencyGapStats, fetchCompetencyTrends } from '@/lib/db/competency-gaps'
import { CompetencyGapDashboard } from '@/components/competency-gap-dashboard'
import { TableSkeleton } from '@/components/skeletons'

async function CompetencyGapContent() {
  const user = await requireRole(['manager'])

  const publishedCycles = await prisma.cycle.findMany({
    where: { status: 'published' },
    orderBy: { published_at: 'desc' },
    take: 10,
    select: { id: true, name: true },
  })

  const latestCycleId = publishedCycles[0]?.id
  if (!latestCycleId) {
    return <CompetencyGapDashboard role="manager" rows={[]} stats={{ competencies: [], overallAvg: {}, deptAvg: {}, lowestCompetency: null, lowestDept: null, overallScore: 0 }} trends={[]} cycles={[]} selectedCycleId="" departments={[]} />
  }

  const opts = { managerId: user.id }
  const [{ rows }, stats, trends] = await Promise.all([
    fetchCompetencyGapData(latestCycleId, opts),
    fetchCompetencyGapStats(latestCycleId, opts),
    fetchCompetencyTrends(
      (await prisma.competency.findMany({ where: { is_active: true }, select: { id: true } })).map(c => c.id),
      opts
    ),
  ])

  return (
    <CompetencyGapDashboard
      role="manager"
      rows={rows}
      stats={stats}
      trends={trends}
      cycles={publishedCycles}
      selectedCycleId={latestCycleId}
      departments={[]}
    />
  )
}

export default function ManagerCompetencyGapsPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <CompetencyGapContent />
    </Suspense>
  )
}
```

**Step 4: Commit**

```bash
git add src/app/(dashboard)/admin/competency-gaps/page.tsx src/app/(dashboard)/hrbp/competency-gaps/page.tsx src/app/(dashboard)/manager/competency-gaps/page.tsx
git commit -m "feat(competency-gaps): add admin, hrbp, and manager route pages"
```

---

### Task 5: Sidebar nav links

**Files:**
- Modify: `src/components/sidebar.tsx`

**Step 1: Add imports**

Add `Crosshair` (or `Target` already imported) icon if needed. The competency gaps link should go after "Top Talent" in each role's nav.

**Step 2: Add nav items**

In the `NAV_ITEMS` object:

- **admin** array: After `{ label: 'Top Talent', ... }`, add:
  ```typescript
  { label: 'Competency Gaps', href: '/admin/competency-gaps', icon: Target },
  ```

- **hrbp** array: After `{ label: 'Top Talent', ... }`, add:
  ```typescript
  { label: 'Competency Gaps', href: '/hrbp/competency-gaps', icon: Target },
  ```

- **manager** array: After `{ label: 'Top Talent', ... }`, add:
  ```typescript
  { label: 'Competency Gaps', href: '/manager/competency-gaps', icon: Target },
  ```

Note: `Target` is already imported in sidebar.tsx (used for KRA Templates and Competencies).

**Step 3: Commit**

```bash
git add src/components/sidebar.tsx
git commit -m "feat(competency-gaps): add sidebar nav links for all roles"
```

---

### Task 6: Type check and verify

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
git commit -m "fix(competency-gaps): resolve type errors and test fixes"
```
