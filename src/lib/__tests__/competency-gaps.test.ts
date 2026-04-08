import { vi, describe, it, expect, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the functions under test
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    competency: { findMany: vi.fn() },
    cycle: { findUnique: vi.fn(), findMany: vi.fn() },
    reviewQuestion: { findMany: vi.fn() },
    review: { findMany: vi.fn() },
    reviewResponse: { findMany: vi.fn() },
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/prisma'
import {
  fetchCompetencyGapData,
  fetchCompetencyGapStats,
  fetchCompetencyTrends,
} from '@/lib/db/competency-gaps'

const mockPrisma = prisma as any

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    employee: { id: empId, full_name: empName, department: { name: dept } },
  }
}

function makeResponse(
  reviewId: string,
  questionId: string,
  respondentId: string,
  rating: number,
) {
  return {
    review_id: reviewId,
    question_id: questionId,
    respondent_id: respondentId,
    rating_value: rating,
  }
}

const CYCLE_ID = 'cycle-1'

/** Sets up the standard happy-path mocks for a single fetchCompetencyGapData call. */
function setupGapDataMocks(overrides?: {
  competencies?: any[]
  cycle?: any
  questions?: any[]
  reviews?: any[]
  responses?: any[]
}) {
  mockPrisma.competency.findMany.mockResolvedValue(
    overrides?.competencies ?? COMPETENCIES,
  )
  mockPrisma.cycle.findUnique.mockResolvedValue(
    overrides?.cycle ?? { review_template_id: 'tmpl-1' },
  )
  mockPrisma.reviewQuestion.findMany.mockResolvedValue(
    overrides?.questions ?? QUESTIONS,
  )
  mockPrisma.review.findMany.mockResolvedValue(overrides?.reviews ?? [])
  mockPrisma.reviewResponse.findMany.mockResolvedValue(
    overrides?.responses ?? [],
  )
}

// ---------------------------------------------------------------------------
// Tests — fetchCompetencyGapData
// ---------------------------------------------------------------------------

describe('fetchCompetencyGapData', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty when no competencies exist', async () => {
    setupGapDataMocks({ competencies: [] })

    const result = await fetchCompetencyGapData(CYCLE_ID)
    expect(result).toEqual({ rows: [], competencies: [] })
    // Should not proceed to query cycle
    expect(mockPrisma.cycle.findUnique).not.toHaveBeenCalled()
  })

  it('returns empty when cycle has no review template', async () => {
    setupGapDataMocks({ cycle: { review_template_id: null } })

    const result = await fetchCompetencyGapData(CYCLE_ID)
    expect(result).toEqual({ rows: [], competencies: [] })
    expect(mockPrisma.reviewQuestion.findMany).not.toHaveBeenCalled()
  })

  it('returns empty when no competency-linked questions', async () => {
    setupGapDataMocks({ questions: [] })

    const result = await fetchCompetencyGapData(CYCLE_ID)
    expect(result).toEqual({ rows: [], competencies: [] })
    expect(mockPrisma.review.findMany).not.toHaveBeenCalled()
  })

  it('computes per-employee per-competency averages from manager ratings only', async () => {
    const review = makeReview('emp-1', 'Alice', 'Engineering')

    setupGapDataMocks({
      reviews: [review],
      responses: [
        // Manager rating on Communication
        makeResponse('review-emp-1', 'q-1', 'mgr-1', 4),
        // Another manager rating on Communication
        makeResponse('review-emp-1', 'q-1', 'mgr-2', 3),
        // Self-response on Communication — should be excluded
        makeResponse('review-emp-1', 'q-1', 'emp-1', 5),
        // Manager rating on Leadership
        makeResponse('review-emp-1', 'q-2', 'mgr-1', 2),
      ],
    })

    const result = await fetchCompetencyGapData(CYCLE_ID)

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].employeeId).toBe('emp-1')
    expect(result.rows[0].employeeName).toBe('Alice')
    expect(result.rows[0].department).toBe('Engineering')
    // Communication avg: (4+3)/2 = 3.5 (self-rating of 5 excluded)
    expect(result.rows[0].competencyScores['comp-1']).toBe(3.5)
    // Leadership avg: 2/1 = 2
    expect(result.rows[0].competencyScores['comp-2']).toBe(2)
  })

  it('filters by managerId when provided', async () => {
    setupGapDataMocks({ reviews: [] })

    await fetchCompetencyGapData(CYCLE_ID, { managerId: 'mgr-1' })

    const reviewCall = mockPrisma.review.findMany.mock.calls[0][0]
    expect(reviewCall.where.employee.manager_id).toBe('mgr-1')
  })

  it('filters by departmentId when provided', async () => {
    setupGapDataMocks({ reviews: [] })

    await fetchCompetencyGapData(CYCLE_ID, { departmentId: 'dept-1' })

    const reviewCall = mockPrisma.review.findMany.mock.calls[0][0]
    expect(reviewCall.where.employee.department_id).toBe('dept-1')
  })

  it('only includes competencies that have linked questions', async () => {
    const review = makeReview('emp-1', 'Alice', 'Engineering')

    // Only comp-1 has a linked question; comp-2 does not
    setupGapDataMocks({
      questions: [{ id: 'q-1', competency_id: 'comp-1' }],
      reviews: [review],
      responses: [makeResponse('review-emp-1', 'q-1', 'mgr-1', 4)],
    })

    const result = await fetchCompetencyGapData(CYCLE_ID)

    expect(result.competencies).toHaveLength(1)
    expect(result.competencies[0].id).toBe('comp-1')
    expect(result.competencies[0].name).toBe('Communication')
  })
})

// ---------------------------------------------------------------------------
// Tests — fetchCompetencyGapStats
// ---------------------------------------------------------------------------

describe('fetchCompetencyGapStats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('computes overall and dept averages correctly', async () => {
    const reviewEng = makeReview('emp-1', 'Alice', 'Engineering')
    const reviewSales = makeReview('emp-2', 'Bob', 'Sales')

    setupGapDataMocks({
      reviews: [reviewEng, reviewSales],
      responses: [
        // Eng: Communication=4, Leadership=3
        makeResponse('review-emp-1', 'q-1', 'mgr-1', 4),
        makeResponse('review-emp-1', 'q-2', 'mgr-1', 3),
        // Sales: Communication=2, Leadership=5
        makeResponse('review-emp-2', 'q-1', 'mgr-2', 2),
        makeResponse('review-emp-2', 'q-2', 'mgr-2', 5),
      ],
    })

    const stats = await fetchCompetencyGapStats(CYCLE_ID)

    // Overall avg: Communication=(4+2)/2=3, Leadership=(3+5)/2=4
    expect(stats.overallAvg['comp-1']).toBe(3)
    expect(stats.overallAvg['comp-2']).toBe(4)

    // Dept avg: Engineering Communication=4, Leadership=3
    expect(stats.deptAvg['Engineering']['comp-1']).toBe(4)
    expect(stats.deptAvg['Engineering']['comp-2']).toBe(3)

    // Dept avg: Sales Communication=2, Leadership=5
    expect(stats.deptAvg['Sales']['comp-1']).toBe(2)
    expect(stats.deptAvg['Sales']['comp-2']).toBe(5)
  })

  it('identifies lowest competency and lowest dept', async () => {
    const reviewEng = makeReview('emp-1', 'Alice', 'Engineering')
    const reviewSales = makeReview('emp-2', 'Bob', 'Sales')

    setupGapDataMocks({
      reviews: [reviewEng, reviewSales],
      responses: [
        // Engineering: Communication=4, Leadership=3 => dept avg 3.5
        makeResponse('review-emp-1', 'q-1', 'mgr-1', 4),
        makeResponse('review-emp-1', 'q-2', 'mgr-1', 3),
        // Sales: Communication=2, Leadership=1 => dept avg 1.5
        makeResponse('review-emp-2', 'q-1', 'mgr-2', 2),
        makeResponse('review-emp-2', 'q-2', 'mgr-2', 1),
      ],
    })

    const stats = await fetchCompetencyGapStats(CYCLE_ID)

    // Overall avg: Communication=(4+2)/2=3, Leadership=(3+1)/2=2
    // Lowest competency is Leadership at 2
    expect(stats.lowestCompetency).toEqual({ name: 'Leadership', avg: 2 })

    // Dept averages: Engineering=(4+3)/2=3.5, Sales=(2+1)/2=1.5
    expect(stats.lowestDept).toEqual({ name: 'Sales', avg: 1.5 })
  })

  it('returns 0 overallScore when no data', async () => {
    setupGapDataMocks({ competencies: [] })

    const stats = await fetchCompetencyGapStats(CYCLE_ID)

    expect(stats.overallScore).toBe(0)
    expect(stats.lowestCompetency).toBeNull()
    expect(stats.lowestDept).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Tests — fetchCompetencyTrends
// ---------------------------------------------------------------------------

describe('fetchCompetencyTrends', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns trend points across published cycles in chronological order', async () => {
    const cycles = [
      { id: 'cycle-2', name: 'Q2 2026' }, // most recent first (from DB)
      { id: 'cycle-1', name: 'Q1 2026' },
    ]

    mockPrisma.cycle.findMany.mockResolvedValue(cycles)

    // fetchCompetencyTrends calls fetchCompetencyGapData for each cycle.
    // We need to set up the mocks so each sequential call returns appropriate data.
    // The function reverses cycles to chronological (Q1, Q2) then calls fetchCompetencyGapData for each.

    // For each call to fetchCompetencyGapData, the mocks are called fresh.
    // We'll use mockResolvedValue for competency/cycle/questions and track review/response per cycle.
    mockPrisma.competency.findMany.mockResolvedValue(COMPETENCIES)
    mockPrisma.reviewQuestion.findMany.mockResolvedValue(QUESTIONS)

    // cycle.findUnique is called for each cycle — always return a template
    mockPrisma.cycle.findUnique.mockResolvedValue({ review_template_id: 'tmpl-1' })

    const reviewCycle1 = makeReview('emp-1', 'Alice', 'Engineering')
    const reviewCycle2 = makeReview('emp-1', 'Alice', 'Engineering')

    let reviewCallCount = 0
    mockPrisma.review.findMany.mockImplementation(() => {
      reviewCallCount++
      if (reviewCallCount === 1) return Promise.resolve([reviewCycle1])
      return Promise.resolve([reviewCycle2])
    })

    let responseCallCount = 0
    mockPrisma.reviewResponse.findMany.mockImplementation(() => {
      responseCallCount++
      if (responseCallCount === 1) {
        // Q1: Communication=3
        return Promise.resolve([
          makeResponse('review-emp-1', 'q-1', 'mgr-1', 3),
        ])
      }
      // Q2: Communication=4
      return Promise.resolve([
        makeResponse('review-emp-1', 'q-1', 'mgr-1', 4),
      ])
    })

    const trends = await fetchCompetencyTrends(['comp-1'])

    expect(trends).toHaveLength(2)
    // Chronological: Q1 first, Q2 second
    expect(trends[0].cycleName).toBe('Q1 2026')
    expect(trends[0].averages['comp-1']).toBe(3)
    expect(trends[1].cycleName).toBe('Q2 2026')
    expect(trends[1].averages['comp-1']).toBe(4)
  })

  it('returns empty when no published cycles', async () => {
    mockPrisma.cycle.findMany.mockResolvedValue([])

    const trends = await fetchCompetencyTrends(['comp-1'])
    expect(trends).toEqual([])
  })
})
