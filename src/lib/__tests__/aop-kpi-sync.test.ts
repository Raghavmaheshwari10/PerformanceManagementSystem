import { vi, describe, it, expect, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the functions under test
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    departmentAop: { findUniqueOrThrow: vi.fn() },
    cycle: { findUniqueOrThrow: vi.fn() },
    kpiTemplate: { findFirst: vi.fn() },
    kpi: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    kra: { findFirst: vi.fn(), create: vi.fn() },
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/prisma'
import { createKpisFromCascade } from '@/lib/aop-kpi-sync'

const mockPrisma = prisma as any

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a department AOP with nested org_aop and employee_aops */
function makeDeptAop(overrides: {
  metric?: string
  fiscal_year?: string
  employeeAops?: object[]
} = {}) {
  const metric = overrides.metric ?? 'delivered_revenue'
  const fiscal_year = overrides.fiscal_year ?? 'FY2026'
  const employeeAops = overrides.employeeAops ?? [makeEmpAop()]

  return {
    id: 'dept-aop-1',
    org_aop: { id: 'org-aop-1', metric, fiscal_year },
    employee_aops: employeeAops,
  }
}

/** Build a single employee AOP row */
function makeEmpAop(overrides: Partial<{
  id: string
  employee_id: string
  exited_at: Date | null
  apr: number; may: number; jun: number; jul: number; aug: number; sep: number
  oct: number; nov: number; dec: number; jan: number; feb: number; mar: number
  manager_id: string | null
}> = {}) {
  return {
    id: overrides.id ?? 'emp-aop-1',
    employee_id: overrides.employee_id ?? 'emp-1',
    exited_at: overrides.exited_at ?? null,
    apr: overrides.apr ?? 100,
    may: overrides.may ?? 100,
    jun: overrides.jun ?? 100,
    jul: overrides.jul ?? 100,
    aug: overrides.aug ?? 100,
    sep: overrides.sep ?? 100,
    oct: overrides.oct ?? 100,
    nov: overrides.nov ?? 100,
    dec: overrides.dec ?? 100,
    jan: overrides.jan ?? 100,
    feb: overrides.feb ?? 100,
    mar: overrides.mar ?? 100,
    employee: {
      id: overrides.employee_id ?? 'emp-1',
      manager_id: overrides.manager_id !== undefined ? overrides.manager_id : 'mgr-1',
    },
  }
}

/** Build a cycle record */
function makeCycle(cycleType: string, period: string | null) {
  return { id: 'cycle-1', cycle_type: cycleType, period }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: no kpiTemplate, no existing kpi, kra.findFirst returns null, kra.create returns new kra
  mockPrisma.kpiTemplate.findFirst.mockResolvedValue(null)
  mockPrisma.kpi.findFirst.mockResolvedValue(null)
  mockPrisma.kra.findFirst.mockResolvedValue(null)
  mockPrisma.kra.create.mockResolvedValue({ id: 'kra-1' })
  mockPrisma.kpi.create.mockResolvedValue({ id: 'kpi-1' })
  mockPrisma.kpi.update.mockResolvedValue({ id: 'kpi-1' })
})

// ---------------------------------------------------------------------------
// createKpisFromCascade — getCycleMonths (tested indirectly)
// ---------------------------------------------------------------------------

describe('createKpisFromCascade — monthly cycle', () => {
  it('uses only the specified month target for a monthly cycle', async () => {
    // Only apr month used; employee has apr=100
    const empAop = makeEmpAop({ apr: 100, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, jan: 0, feb: 0, mar: 0 })
    mockPrisma.departmentAop.findUniqueOrThrow.mockResolvedValue(makeDeptAop({ employeeAops: [empAop] }))
    mockPrisma.cycle.findUniqueOrThrow.mockResolvedValue(makeCycle('monthly', 'apr'))

    await createKpisFromCascade('dept-aop-1', 'cycle-1')

    expect(mockPrisma.kpi.create).toHaveBeenCalledTimes(1)
    const createCall = mockPrisma.kpi.create.mock.calls[0][0]
    expect(createCall.data.target).toBe(100)
  })
})

describe('createKpisFromCascade — quarterly cycle Q1', () => {
  it('sums apr+may+jun for Q1', async () => {
    const empAop = makeEmpAop({ apr: 100, may: 200, jun: 300, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, jan: 0, feb: 0, mar: 0 })
    mockPrisma.departmentAop.findUniqueOrThrow.mockResolvedValue(makeDeptAop({ employeeAops: [empAop] }))
    mockPrisma.cycle.findUniqueOrThrow.mockResolvedValue(makeCycle('quarterly', 'Q1'))

    await createKpisFromCascade('dept-aop-1', 'cycle-1')

    expect(mockPrisma.kpi.create).toHaveBeenCalledTimes(1)
    const createCall = mockPrisma.kpi.create.mock.calls[0][0]
    expect(createCall.data.target).toBe(600) // 100 + 200 + 300
  })
})

describe('createKpisFromCascade — annual cycle', () => {
  it('sums all 12 months for an annual cycle', async () => {
    // 100 per month × 12 = 1200
    const empAop = makeEmpAop()
    mockPrisma.departmentAop.findUniqueOrThrow.mockResolvedValue(makeDeptAop({ employeeAops: [empAop] }))
    mockPrisma.cycle.findUniqueOrThrow.mockResolvedValue(makeCycle('annual', null))

    await createKpisFromCascade('dept-aop-1', 'cycle-1')

    expect(mockPrisma.kpi.create).toHaveBeenCalledTimes(1)
    const createCall = mockPrisma.kpi.create.mock.calls[0][0]
    expect(createCall.data.target).toBe(1200)
  })
})

describe('createKpisFromCascade — skips exited employees', () => {
  it('does not create a KPI for an employee with exited_at set', async () => {
    const exitedEmpAop = makeEmpAop({ exited_at: new Date('2025-06-30') })
    mockPrisma.departmentAop.findUniqueOrThrow.mockResolvedValue(makeDeptAop({ employeeAops: [exitedEmpAop] }))
    mockPrisma.cycle.findUniqueOrThrow.mockResolvedValue(makeCycle('annual', null))

    await createKpisFromCascade('dept-aop-1', 'cycle-1')

    expect(mockPrisma.kpi.create).not.toHaveBeenCalled()
    expect(mockPrisma.kra.create).not.toHaveBeenCalled()
  })
})

describe('createKpisFromCascade — idempotent', () => {
  it('does not call kpi.create when a KPI already exists with the same target', async () => {
    const empAop = makeEmpAop()
    mockPrisma.departmentAop.findUniqueOrThrow.mockResolvedValue(makeDeptAop({ employeeAops: [empAop] }))
    mockPrisma.cycle.findUniqueOrThrow.mockResolvedValue(makeCycle('annual', null))
    // Existing KPI with same target (1200)
    mockPrisma.kpi.findFirst.mockResolvedValue({ id: 'kpi-existing', target: 1200 })

    await createKpisFromCascade('dept-aop-1', 'cycle-1')

    expect(mockPrisma.kpi.create).not.toHaveBeenCalled()
    expect(mockPrisma.kpi.update).not.toHaveBeenCalled()
  })

  it('calls kpi.update (not create) when existing KPI has a different target', async () => {
    const empAop = makeEmpAop()
    mockPrisma.departmentAop.findUniqueOrThrow.mockResolvedValue(makeDeptAop({ employeeAops: [empAop] }))
    mockPrisma.cycle.findUniqueOrThrow.mockResolvedValue(makeCycle('annual', null))
    // Existing KPI with stale target
    mockPrisma.kpi.findFirst.mockResolvedValue({ id: 'kpi-existing', target: 999 })

    await createKpisFromCascade('dept-aop-1', 'cycle-1')

    expect(mockPrisma.kpi.create).not.toHaveBeenCalled()
    expect(mockPrisma.kpi.update).toHaveBeenCalledTimes(1)
    const updateCall = mockPrisma.kpi.update.mock.calls[0][0]
    expect(updateCall.data.target).toBe(1200)
  })
})

describe('createKpisFromCascade — no manager_id', () => {
  it('skips creating a KPI when employee has no manager_id', async () => {
    const empAop = makeEmpAop({ manager_id: null })
    mockPrisma.departmentAop.findUniqueOrThrow.mockResolvedValue(makeDeptAop({ employeeAops: [empAop] }))
    mockPrisma.cycle.findUniqueOrThrow.mockResolvedValue(makeCycle('annual', null))

    await createKpisFromCascade('dept-aop-1', 'cycle-1')

    expect(mockPrisma.kpi.create).not.toHaveBeenCalled()
  })
})

describe('createKpisFromCascade — creates KRA if not exists', () => {
  it('calls kra.create when no matching KRA is found', async () => {
    const empAop = makeEmpAop()
    mockPrisma.departmentAop.findUniqueOrThrow.mockResolvedValue(makeDeptAop({ employeeAops: [empAop] }))
    mockPrisma.cycle.findUniqueOrThrow.mockResolvedValue(makeCycle('annual', null))
    mockPrisma.kra.findFirst.mockResolvedValue(null) // No existing KRA

    await createKpisFromCascade('dept-aop-1', 'cycle-1')

    expect(mockPrisma.kra.create).toHaveBeenCalledTimes(1)
    const kraCreateCall = mockPrisma.kra.create.mock.calls[0][0]
    expect(kraCreateCall.data.title).toBe('AOP Targets')
    expect(kraCreateCall.data.cycle_id).toBe('cycle-1')
    expect(kraCreateCall.data.employee_id).toBe('emp-1')
    // KPI should still be created after KRA
    expect(mockPrisma.kpi.create).toHaveBeenCalledTimes(1)
  })

  it('reuses existing KRA and does not call kra.create', async () => {
    const empAop = makeEmpAop()
    mockPrisma.departmentAop.findUniqueOrThrow.mockResolvedValue(makeDeptAop({ employeeAops: [empAop] }))
    mockPrisma.cycle.findUniqueOrThrow.mockResolvedValue(makeCycle('annual', null))
    mockPrisma.kra.findFirst.mockResolvedValue({ id: 'kra-existing' }) // Existing KRA

    await createKpisFromCascade('dept-aop-1', 'cycle-1')

    expect(mockPrisma.kra.create).not.toHaveBeenCalled()
    // KPI should reference the existing KRA
    const kpiCreateCall = mockPrisma.kpi.create.mock.calls[0][0]
    expect(kpiCreateCall.data.kra_id).toBe('kra-existing')
  })
})
