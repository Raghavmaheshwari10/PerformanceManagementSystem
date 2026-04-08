import { vi, describe, it, expect, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the functions under test
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    topTalentConfig: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    cycle: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    appraisal: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    review: { findMany: vi.fn() },
    goal: { findMany: vi.fn() },
    peerReviewRequest: { findMany: vi.fn() },
    feedback: { groupBy: vi.fn() },
    user: { count: vi.fn() },
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/prisma'
import {
  fetchTopTalentConfig,
  saveTopTalentConfig,
  fetchTopTalentPool,
  fetchTopTalentStats,
} from '@/lib/db/top-talent'

// Typed mock references
const mockPrisma = prisma as any

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = {
  id: 'config-1',
  rating_tiers: ['FEE', 'EE'],
  min_cycles: 1,
  score_threshold: 0,
  mis_threshold: 0,
  updated_by: null,
  updated_at: new Date(),
}

const CYCLE_1 = {
  id: 'cycle-1',
  name: 'Q1 2026',
  status: 'published',
  published_at: new Date('2026-03-01'),
}

function makeAppraisal(overrides: Record<string, any> = {}) {
  return {
    employee_id: 'emp-1',
    cycle_id: 'cycle-1',
    final_rating: 'FEE',
    competency_score: 85,
    mis_score: 90,
    payout_multiplier: 1.5,
    payout_amount: 50000,
    is_exit_frozen: false,
    employee: {
      id: 'emp-1',
      full_name: 'Alice Johnson',
      email: 'alice@test.com',
      designation: 'Senior Engineer',
      department: { name: 'Engineering' },
      manager_id: 'mgr-1',
      manager: { full_name: 'Bob Manager' },
      variable_pay: 100000,
    },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchTopTalentConfig', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns existing config when found', async () => {
    mockPrisma.topTalentConfig.findFirst.mockResolvedValue(DEFAULT_CONFIG)

    const config = await fetchTopTalentConfig()
    expect(config).toEqual(DEFAULT_CONFIG)
    expect(mockPrisma.topTalentConfig.create).not.toHaveBeenCalled()
  })

  it('creates default config when none exists', async () => {
    mockPrisma.topTalentConfig.findFirst.mockResolvedValue(null)
    mockPrisma.topTalentConfig.create.mockResolvedValue(DEFAULT_CONFIG)

    const config = await fetchTopTalentConfig()
    expect(mockPrisma.topTalentConfig.create).toHaveBeenCalledWith({
      data: {
        rating_tiers: ['FEE', 'EE'],
        min_cycles: 1,
        score_threshold: 0,
        mis_threshold: 0,
      },
    })
    expect(config).toEqual(DEFAULT_CONFIG)
  })
})

describe('saveTopTalentConfig', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates existing config', async () => {
    mockPrisma.topTalentConfig.findFirst.mockResolvedValue(DEFAULT_CONFIG)
    mockPrisma.topTalentConfig.update.mockResolvedValue({ ...DEFAULT_CONFIG, min_cycles: 3 })

    const result = await saveTopTalentConfig({
      ratingTiers: ['FEE'],
      minCycles: 3,
      scoreThreshold: 50,
      misThreshold: 40,
      updatedBy: 'admin-1',
    })

    expect(mockPrisma.topTalentConfig.update).toHaveBeenCalledWith({
      where: { id: 'config-1' },
      data: expect.objectContaining({
        rating_tiers: ['FEE'],
        min_cycles: 3,
        score_threshold: 50,
        mis_threshold: 40,
        updated_by: 'admin-1',
      }),
    })
  })

  it('creates new config when none exists', async () => {
    mockPrisma.topTalentConfig.findFirst.mockResolvedValue(null)
    mockPrisma.topTalentConfig.create.mockResolvedValue(DEFAULT_CONFIG)

    await saveTopTalentConfig({
      ratingTiers: ['FEE', 'EE'],
      minCycles: 2,
      scoreThreshold: 0,
      misThreshold: 0,
      updatedBy: 'admin-1',
    })

    expect(mockPrisma.topTalentConfig.create).toHaveBeenCalled()
  })
})

describe('fetchTopTalentPool', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: config exists, one published cycle, standard batch results
    mockPrisma.topTalentConfig.findFirst.mockResolvedValue(DEFAULT_CONFIG)
    mockPrisma.cycle.findFirst.mockResolvedValue(CYCLE_1)
    mockPrisma.cycle.findMany.mockResolvedValue([CYCLE_1])
    mockPrisma.review.findMany.mockResolvedValue([])
    mockPrisma.goal.findMany.mockResolvedValue([])
    mockPrisma.peerReviewRequest.findMany.mockResolvedValue([])
    mockPrisma.feedback.groupBy.mockResolvedValue([])
  })

  function setupPool(qualifying: any[], history?: any[]) {
    let callCount = 0
    mockPrisma.appraisal.findMany.mockImplementation(() => {
      callCount++
      if (callCount === 1) return Promise.resolve(qualifying)
      return Promise.resolve(history ?? qualifying)
    })
  }

  it('returns empty array when no published cycle exists', async () => {
    mockPrisma.cycle.findFirst.mockImplementation(() => Promise.resolve(null))
    const result = await fetchTopTalentPool()
    expect(result).toEqual([])
  })

  it('returns qualifying employees from latest published cycle', async () => {
    const appraisal = makeAppraisal()
    setupPool([appraisal])

    const pool = await fetchTopTalentPool()

    expect(pool).toHaveLength(1)
    expect(pool[0].fullName).toBe('Alice Johnson')
    expect(pool[0].currentCycle.finalRating).toBe('FEE')
    expect(pool[0].currentCycle.compositeScore).toBe(85)
    expect(pool[0].department).toBe('Engineering')
  })

  it('filters by managerId for manager scoping', async () => {
    const appraisal = makeAppraisal()
    setupPool([appraisal])

    await fetchTopTalentPool({ managerId: 'mgr-1' })

    const appraisalCall = mockPrisma.appraisal.findMany.mock.calls[0][0]
    expect(appraisalCall.where.employee).toEqual({ manager_id: 'mgr-1' })
  })

  it('excludes employees below min_cycles threshold', async () => {
    mockPrisma.topTalentConfig.findFirst.mockResolvedValue({
      ...DEFAULT_CONFIG,
      min_cycles: 3,
    })
    setupPool([makeAppraisal()])

    const pool = await fetchTopTalentPool()
    expect(pool).toHaveLength(0)
  })

  it('excludes employees below score_threshold', async () => {
    mockPrisma.topTalentConfig.findFirst.mockResolvedValue({
      ...DEFAULT_CONFIG,
      score_threshold: 90,
    })
    setupPool([makeAppraisal({ competency_score: 85 })])

    const pool = await fetchTopTalentPool()
    expect(pool).toHaveLength(0)
  })

  it('excludes employees below mis_threshold', async () => {
    mockPrisma.topTalentConfig.findFirst.mockResolvedValue({
      ...DEFAULT_CONFIG,
      mis_threshold: 95,
    })
    setupPool([makeAppraisal({ mis_score: 90 })])

    const pool = await fetchTopTalentPool()
    expect(pool).toHaveLength(0)
  })

  it('excludes exit-frozen employees', async () => {
    setupPool([])
    const pool = await fetchTopTalentPool()
    expect(pool).toHaveLength(0)
  })

  it('sorts by composite score descending', async () => {
    const emp1 = makeAppraisal({
      employee_id: 'emp-1',
      competency_score: 80,
      employee: { ...makeAppraisal().employee, id: 'emp-1', full_name: 'Low Score' },
    })
    const emp2 = makeAppraisal({
      employee_id: 'emp-2',
      competency_score: 95,
      employee: { ...makeAppraisal().employee, id: 'emp-2', full_name: 'High Score' },
    })
    setupPool([emp1, emp2])

    const pool = await fetchTopTalentPool()
    expect(pool).toHaveLength(2)
    expect(pool[0].fullName).toBe('High Score')
    expect(pool[1].fullName).toBe('Low Score')
  })

  it('calculates goal completion correctly', async () => {
    const appraisal = makeAppraisal()
    setupPool([appraisal])

    mockPrisma.goal.findMany.mockImplementation(() => Promise.resolve([
      { employee_id: 'emp-1', status: 'completed' },
      { employee_id: 'emp-1', status: 'approved' },
      { employee_id: 'emp-1', status: 'draft' },
      { employee_id: 'emp-1', status: 'submitted' },
    ]))

    const pool = await fetchTopTalentPool()
    expect(pool[0].goalCompletion).toBe(50)
  })

  it('calculates trend correctly with previous cycle', async () => {
    const cycle2 = { id: 'cycle-2', name: 'Q4 2025', status: 'published', published_at: new Date('2025-12-01') }
    mockPrisma.cycle.findMany.mockResolvedValue([CYCLE_1, cycle2])

    const currentAppraisal = makeAppraisal({ final_rating: 'FEE' })
    const prevAppraisal = makeAppraisal({ cycle_id: 'cycle-2', final_rating: 'EE' })
    setupPool([currentAppraisal], [currentAppraisal, prevAppraisal])

    const pool = await fetchTopTalentPool()
    expect(pool[0].trend).toBe('up')
  })

  it('calculates consecutive high cycles correctly', async () => {
    const cycle2 = { id: 'cycle-2', name: 'Q4 2025', published_at: new Date('2025-12-01') }
    const cycle3 = { id: 'cycle-3', name: 'Q3 2025', published_at: new Date('2025-09-01') }
    mockPrisma.cycle.findMany.mockResolvedValue([CYCLE_1, cycle2, cycle3])

    const currentAppraisal = makeAppraisal({ final_rating: 'FEE' })
    const prevAppraisal1 = makeAppraisal({ cycle_id: 'cycle-2', final_rating: 'EE' })
    const prevAppraisal2 = makeAppraisal({ cycle_id: 'cycle-3', final_rating: 'ME' })

    setupPool([currentAppraisal], [currentAppraisal, prevAppraisal1, prevAppraisal2])

    const pool = await fetchTopTalentPool()
    expect(pool[0].consecutiveHighCycles).toBe(2)
  })
})

describe('fetchTopTalentStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.topTalentConfig.findFirst.mockResolvedValue(DEFAULT_CONFIG)
    mockPrisma.cycle.findFirst.mockResolvedValue(CYCLE_1)
    mockPrisma.cycle.findMany.mockResolvedValue([CYCLE_1])
    mockPrisma.review.findMany.mockResolvedValue([])
    mockPrisma.goal.findMany.mockResolvedValue([])
    mockPrisma.peerReviewRequest.findMany.mockResolvedValue([])
    mockPrisma.feedback.groupBy.mockResolvedValue([])
    mockPrisma.appraisal.findMany.mockResolvedValue([])
    mockPrisma.appraisal.groupBy.mockResolvedValue([])
  })

  function setupStatsPool(qualifying: any[], history?: any[]) {
    let callCount = 0
    mockPrisma.appraisal.findMany.mockImplementation(() => {
      callCount++
      if (callCount === 1) return Promise.resolve(qualifying)
      return Promise.resolve(history ?? qualifying)
    })
  }

  it('returns zero stats when pool is empty', async () => {
    // fetchTopTalentPool returns [] when no cycle exists
    mockPrisma.cycle.findFirst.mockResolvedValue(null)
    mockPrisma.user.count.mockResolvedValue(50)

    const stats = await fetchTopTalentStats()
    expect(stats.total).toBe(0)
    expect(stats.percentOfOrg).toBe(0)
    expect(stats.avgScore).toBe(0)
    expect(stats.topDepartment).toBeNull()
    expect(stats.byDepartment).toEqual([])
  })

  it('calculates percentOfOrg correctly', async () => {
    setupStatsPool([makeAppraisal()])
    mockPrisma.user.count.mockResolvedValue(10)

    const stats = await fetchTopTalentStats()
    expect(stats.total).toBe(1)
    expect(stats.percentOfOrg).toBe(10)
  })

  it('identifies top department correctly', async () => {
    const emp1 = makeAppraisal({ employee_id: 'emp-1', employee: { ...makeAppraisal().employee, id: 'emp-1', department: { name: 'Engineering' } } })
    const emp2 = makeAppraisal({ employee_id: 'emp-2', employee: { ...makeAppraisal().employee, id: 'emp-2', department: { name: 'Engineering' } } })
    const emp3 = makeAppraisal({ employee_id: 'emp-3', employee: { ...makeAppraisal().employee, id: 'emp-3', department: { name: 'Sales' } } })

    setupStatsPool([emp1, emp2, emp3])
    mockPrisma.user.count.mockResolvedValue(20)

    const stats = await fetchTopTalentStats()
    expect(stats.topDepartment).toBe('Engineering')
    expect(stats.byDepartment[0].department).toBe('Engineering')
    expect(stats.byDepartment[0].count).toBe(2)
  })

  it('calculates avgScore correctly', async () => {
    const emp1 = makeAppraisal({ employee_id: 'emp-1', competency_score: 80, employee: { ...makeAppraisal().employee, id: 'emp-1' } })
    const emp2 = makeAppraisal({ employee_id: 'emp-2', competency_score: 90, employee: { ...makeAppraisal().employee, id: 'emp-2' } })

    setupStatsPool([emp1, emp2])
    mockPrisma.user.count.mockResolvedValue(10)

    const stats = await fetchTopTalentStats()
    expect(stats.avgScore).toBe(85)
  })

  it('includes pool over time data', async () => {
    mockPrisma.cycle.findFirst.mockResolvedValue(null) // no pool
    mockPrisma.user.count.mockResolvedValue(10)
    mockPrisma.appraisal.groupBy.mockResolvedValue([
      { cycle_id: 'cycle-1', _count: { id: 5 } },
    ])

    const stats = await fetchTopTalentStats()
    expect(stats.poolOverTime).toHaveLength(1)
    expect(stats.poolOverTime[0]).toEqual({ cycleName: 'Q1 2026', count: 5 })
  })
})
