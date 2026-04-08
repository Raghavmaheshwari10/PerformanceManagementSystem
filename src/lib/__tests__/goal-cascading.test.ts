import { vi, describe, it, expect, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the functions under test
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cycle: { findUnique: vi.fn(), findFirst: vi.fn() },
    orgGoal: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    deptGoal: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    kpi: { findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
    appraisal: { findMany: vi.fn() },
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/prisma'
import {
  fetchGoalTree,
  fetchGoalCascadingStats,
  createOrgGoal,
  updateOrgGoal,
  deleteOrgGoal,
  createDeptGoal,
  updateDeptGoal,
  deleteDeptGoal,
  linkKpiToDeptGoal,
  unlinkKpi,
} from '@/lib/db/goal-cascading'

const mockPrisma = prisma as any

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CYCLE = { id: 'c1', name: 'Q1 2026' }

function makeKpi(overrides: Record<string, any> = {}) {
  return {
    id: 'kpi-1',
    title: 'Revenue KPI',
    weight: 2,
    manager_rating: null,
    employee_id: 'emp-1',
    employee: { id: 'emp-1', full_name: 'Alice' },
    ...overrides,
  }
}

function makeOrgGoal(kpis: any[] = []) {
  return {
    id: 'og1',
    title: 'Grow Revenue',
    description: null,
    cycle_id: 'c1',
    creator: { full_name: 'Admin' },
    cycle: { id: 'c1', name: 'Q1' },
    dept_goals: [
      {
        id: 'dg1',
        title: 'Sales Target',
        description: null,
        department: { name: 'Sales', id: 'dept-1' },
        creator: { full_name: 'HRBP' },
        kpis,
      },
    ],
  }
}

function setupTreeMocks(overrides?: {
  cycle?: any
  orgGoals?: any[]
  appraisals?: any[]
}) {
  mockPrisma.cycle.findFirst.mockResolvedValue(overrides?.cycle ?? CYCLE)
  mockPrisma.cycle.findUnique.mockResolvedValue(overrides?.cycle ?? CYCLE)
  mockPrisma.orgGoal.findMany.mockResolvedValue(overrides?.orgGoals ?? [])
  mockPrisma.appraisal.findMany.mockResolvedValue(overrides?.appraisals ?? [])
}

// ---------------------------------------------------------------------------
// Tests — fetchGoalTree
// ---------------------------------------------------------------------------

describe('fetchGoalTree', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty when no org goals', async () => {
    setupTreeMocks({ orgGoals: [] })

    const result = await fetchGoalTree()
    expect(result).toEqual([])
  })

  it('returns empty when no published cycle exists', async () => {
    setupTreeMocks({ cycle: null })

    const result = await fetchGoalTree()
    expect(result).toEqual([])
  })

  it('computes weighted progress from KPI scores (appraisal mis_score)', async () => {
    const kpi1 = makeKpi({ id: 'kpi-1', weight: 3, employee_id: 'emp-1' })
    const kpi2 = makeKpi({ id: 'kpi-2', weight: 1, employee_id: 'emp-2', employee: { id: 'emp-2', full_name: 'Bob' } })

    setupTreeMocks({
      orgGoals: [makeOrgGoal([kpi1, kpi2])],
      appraisals: [
        { employee_id: 'emp-1', mis_score: 80 },
        { employee_id: 'emp-2', mis_score: 40 },
      ],
    })

    const result = await fetchGoalTree()

    expect(result).toHaveLength(1)
    const dg = result[0].deptGoals[0]
    // Weighted avg: (3*80 + 1*40) / (3+1) = 280/4 = 70
    expect(dg.progress).toBe(70)
    expect(dg.kpis[0].score).toBe(80)
    expect(dg.kpis[1].score).toBe(40)
  })

  it('falls back to manager_rating when no appraisal (EE -> 80)', async () => {
    const kpi = makeKpi({ manager_rating: 'EE', employee_id: 'emp-1' })

    setupTreeMocks({
      orgGoals: [makeOrgGoal([kpi])],
      appraisals: [], // no appraisal data
    })

    const result = await fetchGoalTree()

    expect(result).toHaveLength(1)
    const kpiResult = result[0].deptGoals[0].kpis[0]
    expect(kpiResult.score).toBe(80)
  })

  it('filters by managerId (check kpis where clause)', async () => {
    setupTreeMocks({ orgGoals: [] })

    await fetchGoalTree({ managerId: 'mgr-1' })

    const orgGoalCall = mockPrisma.orgGoal.findMany.mock.calls[0][0]
    const kpiWhere = orgGoalCall.include.dept_goals.include.kpis.where
    expect(kpiWhere).toEqual({ manager_id: 'mgr-1' })
  })

  it('filters by departmentId (check dept_goals where clause)', async () => {
    setupTreeMocks({ orgGoals: [] })

    await fetchGoalTree({ departmentId: 'dept-1' })

    const orgGoalCall = mockPrisma.orgGoal.findMany.mock.calls[0][0]
    const deptGoalWhere = orgGoalCall.include.dept_goals.where
    expect(deptGoalWhere).toEqual({ department_id: 'dept-1' })
  })

  it('computes org goal progress as avg of dept goals with KPIs', async () => {
    const kpi1 = makeKpi({ id: 'kpi-1', weight: 1, employee_id: 'emp-1' })
    const kpi2 = makeKpi({ id: 'kpi-2', weight: 1, employee_id: 'emp-2', employee: { id: 'emp-2', full_name: 'Bob' } })

    const orgGoal = {
      id: 'og1',
      title: 'Grow Revenue',
      description: null,
      cycle_id: 'c1',
      creator: { full_name: 'Admin' },
      cycle: { id: 'c1', name: 'Q1' },
      dept_goals: [
        {
          id: 'dg1',
          title: 'Sales Target',
          description: null,
          department: { name: 'Sales', id: 'dept-1' },
          creator: { full_name: 'HRBP' },
          kpis: [kpi1],
        },
        {
          id: 'dg2',
          title: 'Marketing Target',
          description: null,
          department: { name: 'Marketing', id: 'dept-2' },
          creator: { full_name: 'HRBP2' },
          kpis: [kpi2],
        },
      ],
    }

    setupTreeMocks({
      orgGoals: [orgGoal],
      appraisals: [
        { employee_id: 'emp-1', mis_score: 90 },
        { employee_id: 'emp-2', mis_score: 50 },
      ],
    })

    const result = await fetchGoalTree()

    // Org progress = avg(90, 50) = 70
    expect(result[0].progress).toBe(70)
    expect(result[0].deptGoals[0].progress).toBe(90)
    expect(result[0].deptGoals[1].progress).toBe(50)
  })

  it('uses null score when no appraisal and no manager rating', async () => {
    const kpi = makeKpi({ manager_rating: null, employee_id: 'emp-1' })

    setupTreeMocks({
      orgGoals: [makeOrgGoal([kpi])],
      appraisals: [],
    })

    const result = await fetchGoalTree()

    expect(result[0].deptGoals[0].kpis[0].score).toBeNull()
    // Progress with null score treated as 0: (2*0)/2 = 0
    expect(result[0].deptGoals[0].progress).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Tests — fetchGoalCascadingStats
// ---------------------------------------------------------------------------

describe('fetchGoalCascadingStats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('counts unlinked KPIs correctly', async () => {
    const kpi = makeKpi({ employee_id: 'emp-1' })

    // Setup for fetchGoalTree (called internally by fetchGoalCascadingStats)
    setupTreeMocks({
      orgGoals: [makeOrgGoal([kpi])],
      appraisals: [{ employee_id: 'emp-1', mis_score: 60 }],
    })

    // The stats function also calls cycle.findFirst/findUnique again for unlinked count
    mockPrisma.kpi.count.mockResolvedValue(5)

    const stats = await fetchGoalCascadingStats()

    expect(stats.unlinkedKpis).toBe(5)
    expect(mockPrisma.kpi.count).toHaveBeenCalledWith({
      where: { cycle_id: 'c1', dept_goal_id: null },
    })
  })

  it('returns 0 for all stats when no data', async () => {
    setupTreeMocks({ cycle: null })
    mockPrisma.kpi.count.mockResolvedValue(0)

    const stats = await fetchGoalCascadingStats()

    expect(stats.totalOrgGoals).toBe(0)
    expect(stats.avgCompletion).toBe(0)
    expect(stats.deptsOnTrack).toBe(0)
    expect(stats.deptsBehind).toBe(0)
    expect(stats.unlinkedKpis).toBe(0)
  })

  it('classifies depts on track (>= 50) and behind (< 50)', async () => {
    const kpiHigh = makeKpi({ id: 'kpi-1', weight: 1, employee_id: 'emp-1' })
    const kpiLow = makeKpi({ id: 'kpi-2', weight: 1, employee_id: 'emp-2', employee: { id: 'emp-2', full_name: 'Bob' } })

    const orgGoal = {
      id: 'og1',
      title: 'Grow Revenue',
      description: null,
      cycle_id: 'c1',
      creator: { full_name: 'Admin' },
      cycle: { id: 'c1', name: 'Q1' },
      dept_goals: [
        {
          id: 'dg1',
          title: 'Sales Target',
          description: null,
          department: { name: 'Sales', id: 'dept-1' },
          creator: { full_name: 'HRBP' },
          kpis: [kpiHigh],
        },
        {
          id: 'dg2',
          title: 'Support Target',
          description: null,
          department: { name: 'Support', id: 'dept-2' },
          creator: { full_name: 'HRBP2' },
          kpis: [kpiLow],
        },
      ],
    }

    setupTreeMocks({
      orgGoals: [orgGoal],
      appraisals: [
        { employee_id: 'emp-1', mis_score: 70 }, // >= 50 on track
        { employee_id: 'emp-2', mis_score: 30 }, // < 50 behind
      ],
    })
    mockPrisma.kpi.count.mockResolvedValue(0)

    const stats = await fetchGoalCascadingStats()

    expect(stats.deptsOnTrack).toBe(1)
    expect(stats.deptsBehind).toBe(1)
    expect(stats.totalOrgGoals).toBe(1)
    expect(stats.avgCompletion).toBe(50) // avg(70, 30) = 50
  })
})

// ---------------------------------------------------------------------------
// Tests — CRUD
// ---------------------------------------------------------------------------

describe('CRUD operations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createOrgGoal calls prisma.orgGoal.create', async () => {
    mockPrisma.orgGoal.create.mockResolvedValue({ id: 'og-new' })

    await createOrgGoal({
      title: 'New Goal',
      description: 'A description',
      cycleId: 'c1',
      createdBy: 'user-1',
    })

    expect(mockPrisma.orgGoal.create).toHaveBeenCalledWith({
      data: {
        title: 'New Goal',
        description: 'A description',
        cycle_id: 'c1',
        created_by: 'user-1',
      },
    })
  })

  it('updateOrgGoal calls prisma.orgGoal.update with correct where/data', async () => {
    mockPrisma.orgGoal.update.mockResolvedValue({ id: 'og1' })

    await updateOrgGoal('og1', { title: 'Updated Title' })

    expect(mockPrisma.orgGoal.update).toHaveBeenCalledWith({
      where: { id: 'og1' },
      data: { title: 'Updated Title' },
    })
  })

  it('deleteOrgGoal calls prisma.orgGoal.delete', async () => {
    mockPrisma.orgGoal.delete.mockResolvedValue({ id: 'og1' })

    await deleteOrgGoal('og1')

    expect(mockPrisma.orgGoal.delete).toHaveBeenCalledWith({
      where: { id: 'og1' },
    })
  })

  it('createDeptGoal calls prisma.deptGoal.create', async () => {
    mockPrisma.deptGoal.create.mockResolvedValue({ id: 'dg-new' })

    await createDeptGoal({
      title: 'Dept Goal',
      description: 'Desc',
      orgGoalId: 'og1',
      departmentId: 'dept-1',
      createdBy: 'user-1',
    })

    expect(mockPrisma.deptGoal.create).toHaveBeenCalledWith({
      data: {
        title: 'Dept Goal',
        description: 'Desc',
        org_goal_id: 'og1',
        department_id: 'dept-1',
        created_by: 'user-1',
      },
    })
  })

  it('updateDeptGoal calls prisma.deptGoal.update', async () => {
    mockPrisma.deptGoal.update.mockResolvedValue({ id: 'dg1' })

    await updateDeptGoal('dg1', { title: 'New Title', description: 'New Desc' })

    expect(mockPrisma.deptGoal.update).toHaveBeenCalledWith({
      where: { id: 'dg1' },
      data: { title: 'New Title', description: 'New Desc' },
    })
  })

  it('deleteDeptGoal calls prisma.deptGoal.delete', async () => {
    mockPrisma.deptGoal.delete.mockResolvedValue({ id: 'dg1' })

    await deleteDeptGoal('dg1')

    expect(mockPrisma.deptGoal.delete).toHaveBeenCalledWith({
      where: { id: 'dg1' },
    })
  })

  it('linkKpiToDeptGoal calls prisma.kpi.update with correct data', async () => {
    mockPrisma.kpi.update.mockResolvedValue({ id: 'kpi-1' })

    await linkKpiToDeptGoal('kpi-1', 'dg1')

    expect(mockPrisma.kpi.update).toHaveBeenCalledWith({
      where: { id: 'kpi-1' },
      data: { dept_goal_id: 'dg1' },
    })
  })

  it('unlinkKpi sets dept_goal_id to null', async () => {
    mockPrisma.kpi.update.mockResolvedValue({ id: 'kpi-1' })

    await unlinkKpi('kpi-1')

    expect(mockPrisma.kpi.update).toHaveBeenCalledWith({
      where: { id: 'kpi-1' },
      data: { dept_goal_id: null },
    })
  })
})
