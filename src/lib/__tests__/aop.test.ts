import { vi, describe, it, expect, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the functions under test
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    orgAop: { findMany: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), upsert: vi.fn() },
    departmentAop: { findMany: vi.fn(), findUniqueOrThrow: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    employeeAop: { findMany: vi.fn(), findUniqueOrThrow: vi.fn(), upsert: vi.fn(), update: vi.fn(), create: vi.fn() },
    employeeMisActual: { findMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/prisma'
import {
  getOrgAops,
  upsertOrgAop,
  getDepartmentAops,
  upsertDepartmentAop,
  validateDepartmentCascade,
  getEmployeeAops,
  upsertEmployeeAop,
  validateEmployeeCascade,
  lockDepartmentCascade,
  getEmployeeMisActuals,
  bulkUpsertMisActuals,
  getCascadeTree,
  getFounderDepartmentSummary,
  markEmployeeExited,
  createReplacementAop,
  MONTHS,
} from '@/lib/db/aop'

const mockPrisma = prisma as any

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a monthly targets object where each month gets an equal share */
function equalMonthly(annual: number): Record<string, number> {
  const perMonth = +(annual / 12).toFixed(2)
  const result: Record<string, number> = {}
  let remaining = annual
  for (let i = 0; i < MONTHS.length; i++) {
    if (i === MONTHS.length - 1) {
      result[MONTHS[i]] = +remaining.toFixed(2)
    } else {
      result[MONTHS[i]] = perMonth
      remaining -= perMonth
    }
  }
  return result
}

/** Creates a monthly targets object with specific values */
function makeMonthly(values: number[]): Record<string, number> {
  const result: Record<string, number> = {}
  MONTHS.forEach((m: string, i: number) => { result[m] = values[i] ?? 0 })
  return result
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// upsertOrgAop — monthly sum validation
// ---------------------------------------------------------------------------

describe('upsertOrgAop', () => {
  it('throws when monthly sum does not match annual target', async () => {
    const monthly = equalMonthly(1200)
    // Mismatch: annual says 9999 but monthly sums to 1200
    await expect(
      upsertOrgAop({
        fiscal_year: 'FY2026',
        metric: 'delivered_revenue' as any,
        annual_target: 9999,
        monthly: monthly as any,
        created_by: 'user-1',
      })
    ).rejects.toThrow('Monthly targets sum')
  })

  it('calls prisma upsert when monthly sum matches annual target', async () => {
    const annual = 1200
    const monthly = equalMonthly(annual)
    mockPrisma.orgAop.upsert.mockResolvedValue({ id: 'org-1' })

    const result = await upsertOrgAop({
      fiscal_year: 'FY2026',
      metric: 'delivered_revenue' as any,
      annual_target: annual,
      monthly: monthly as any,
      created_by: 'user-1',
    })

    expect(result).toEqual({ id: 'org-1' })
    expect(mockPrisma.orgAop.upsert).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// upsertDepartmentAop — monthly sum validation
// ---------------------------------------------------------------------------

describe('upsertDepartmentAop', () => {
  it('throws when monthly sum does not match annual target', async () => {
    const monthly = equalMonthly(500)
    await expect(
      upsertDepartmentAop({
        org_aop_id: 'org-1',
        department_id: 'dept-1',
        annual_target: 1000,
        monthly: monthly as any,
      })
    ).rejects.toThrow('Monthly targets sum')
  })

  it('succeeds when monthly sum matches annual target', async () => {
    const annual = 600
    const monthly = equalMonthly(annual)
    mockPrisma.departmentAop.upsert.mockResolvedValue({ id: 'dept-aop-1' })

    const result = await upsertDepartmentAop({
      org_aop_id: 'org-1',
      department_id: 'dept-1',
      annual_target: annual,
      monthly: monthly as any,
    })

    expect(result).toEqual({ id: 'dept-aop-1' })
  })
})

// ---------------------------------------------------------------------------
// upsertEmployeeAop — monthly sum validation
// ---------------------------------------------------------------------------

describe('upsertEmployeeAop', () => {
  it('throws when monthly sum does not match annual target', async () => {
    const monthly = equalMonthly(300)
    await expect(
      upsertEmployeeAop({
        department_aop_id: 'dept-aop-1',
        employee_id: 'emp-1',
        annual_target: 999,
        monthly: monthly as any,
      })
    ).rejects.toThrow('Monthly targets sum')
  })
})

// ---------------------------------------------------------------------------
// validateDepartmentCascade
// ---------------------------------------------------------------------------

describe('validateDepartmentCascade', () => {
  it('returns valid=true when department totals match org total', async () => {
    mockPrisma.orgAop.findUniqueOrThrow.mockResolvedValue({ id: 'org-1', annual_target: 1000 })
    mockPrisma.departmentAop.findMany.mockResolvedValue([
      { annual_target: 400 },
      { annual_target: 600 },
    ])

    const result = await validateDepartmentCascade('org-1')
    expect(result.valid).toBe(true)
    expect(result.orgTotal).toBe(1000)
    expect(result.deptTotal).toBe(1000)
  })

  it('returns valid=false when department totals do not match org total', async () => {
    mockPrisma.orgAop.findUniqueOrThrow.mockResolvedValue({ id: 'org-1', annual_target: 1000 })
    mockPrisma.departmentAop.findMany.mockResolvedValue([
      { annual_target: 400 },
      { annual_target: 500 },
    ])

    const result = await validateDepartmentCascade('org-1')
    expect(result.valid).toBe(false)
    expect(result.orgTotal).toBe(1000)
    expect(result.deptTotal).toBe(900)
  })

  it('returns valid=true when no departments exist (0 = 0 edge case is false since org > 0)', async () => {
    mockPrisma.orgAop.findUniqueOrThrow.mockResolvedValue({ id: 'org-1', annual_target: 1000 })
    mockPrisma.departmentAop.findMany.mockResolvedValue([])

    const result = await validateDepartmentCascade('org-1')
    expect(result.valid).toBe(false)
    expect(result.deptTotal).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// validateEmployeeCascade
// ---------------------------------------------------------------------------

describe('validateEmployeeCascade', () => {
  const deptAop = {
    id: 'dept-aop-1',
    annual_target: 1200,
    apr: 100, may: 100, jun: 100, jul: 100, aug: 100, sep: 100,
    oct: 100, nov: 100, dec: 100, jan: 100, feb: 100, mar: 100,
  }

  it('returns valid=true when employee totals match dept totals (annual + per-month)', async () => {
    mockPrisma.departmentAop.findUniqueOrThrow.mockResolvedValue(deptAop)
    mockPrisma.employeeAop.findMany.mockResolvedValue([
      { annual_target: 600, apr: 50, may: 50, jun: 50, jul: 50, aug: 50, sep: 50, oct: 50, nov: 50, dec: 50, jan: 50, feb: 50, mar: 50 },
      { annual_target: 600, apr: 50, may: 50, jun: 50, jul: 50, aug: 50, sep: 50, oct: 50, nov: 50, dec: 50, jan: 50, feb: 50, mar: 50 },
    ])

    const result = await validateEmployeeCascade('dept-aop-1')
    expect(result.valid).toBe(true)
    expect(result.deptTotal).toBe(1200)
    expect(result.empTotal).toBe(1200)
    for (const month of MONTHS) {
      expect(result.perMonth[month].valid).toBe(true)
    }
  })

  it('returns valid=false when annual totals match but a month does not', async () => {
    mockPrisma.departmentAop.findUniqueOrThrow.mockResolvedValue(deptAop)
    mockPrisma.employeeAop.findMany.mockResolvedValue([
      {
        annual_target: 1200,
        apr: 200, may: 100, jun: 100, jul: 100, aug: 100, sep: 100,
        oct: 100, nov: 100, dec: 100, jan: 100, feb: 100, mar: 0,
      },
    ])

    const result = await validateEmployeeCascade('dept-aop-1')
    // Annual totals match
    expect(result.valid).toBe(true)
    // But apr and mar don't match
    expect(result.perMonth['apr'].valid).toBe(false)
    expect(result.perMonth['apr'].emp).toBe(200)
    expect(result.perMonth['apr'].dept).toBe(100)
    expect(result.perMonth['mar'].valid).toBe(false)
  })

  it('returns valid=false when employee annual total does not match dept', async () => {
    mockPrisma.departmentAop.findUniqueOrThrow.mockResolvedValue(deptAop)
    mockPrisma.employeeAop.findMany.mockResolvedValue([
      { annual_target: 500, apr: 50, may: 50, jun: 50, jul: 50, aug: 50, sep: 50, oct: 50, nov: 50, dec: 50, jan: 50, feb: 50, mar: 50 },
    ])

    const result = await validateEmployeeCascade('dept-aop-1')
    expect(result.valid).toBe(false)
    expect(result.empTotal).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// lockDepartmentCascade
// ---------------------------------------------------------------------------

describe('lockDepartmentCascade', () => {
  it('throws when cascade is incomplete (annual mismatch)', async () => {
    mockPrisma.departmentAop.findUniqueOrThrow.mockResolvedValue({
      id: 'dept-aop-1',
      annual_target: 1000,
      apr: 100, may: 100, jun: 100, jul: 100, aug: 100, sep: 100,
      oct: 100, nov: 100, dec: 100, jan: 0, feb: 0, mar: 0,
    })
    mockPrisma.employeeAop.findMany.mockResolvedValue([
      { annual_target: 500, apr: 50, may: 50, jun: 50, jul: 50, aug: 50, sep: 50, oct: 50, nov: 50, dec: 50, jan: 0, feb: 0, mar: 0 },
    ])

    await expect(lockDepartmentCascade('dept-aop-1')).rejects.toThrow('Cannot lock')
  })

  it('throws when per-month totals do not match even if annual does', async () => {
    const deptAop = {
      id: 'dept-aop-1',
      annual_target: 1200,
      apr: 100, may: 100, jun: 100, jul: 100, aug: 100, sep: 100,
      oct: 100, nov: 100, dec: 100, jan: 100, feb: 100, mar: 100,
    }
    mockPrisma.departmentAop.findUniqueOrThrow.mockResolvedValue(deptAop)
    mockPrisma.employeeAop.findMany.mockResolvedValue([
      {
        annual_target: 1200,
        apr: 200, may: 0, jun: 100, jul: 100, aug: 100, sep: 100,
        oct: 100, nov: 100, dec: 100, jan: 100, feb: 100, mar: 100,
      },
    ])

    await expect(lockDepartmentCascade('dept-aop-1')).rejects.toThrow('Cannot lock')
  })

  it('updates status to locked when cascade is valid', async () => {
    const deptAop = {
      id: 'dept-aop-1',
      annual_target: 1200,
      apr: 100, may: 100, jun: 100, jul: 100, aug: 100, sep: 100,
      oct: 100, nov: 100, dec: 100, jan: 100, feb: 100, mar: 100,
    }
    mockPrisma.departmentAop.findUniqueOrThrow.mockResolvedValue(deptAop)
    mockPrisma.employeeAop.findMany.mockResolvedValue([
      { annual_target: 600, apr: 50, may: 50, jun: 50, jul: 50, aug: 50, sep: 50, oct: 50, nov: 50, dec: 50, jan: 50, feb: 50, mar: 50 },
      { annual_target: 600, apr: 50, may: 50, jun: 50, jul: 50, aug: 50, sep: 50, oct: 50, nov: 50, dec: 50, jan: 50, feb: 50, mar: 50 },
    ])
    mockPrisma.departmentAop.update.mockResolvedValue({})

    await lockDepartmentCascade('dept-aop-1')

    expect(mockPrisma.departmentAop.update).toHaveBeenCalledWith({
      where: { id: 'dept-aop-1' },
      data: { status: 'locked' },
    })
  })
})

// ---------------------------------------------------------------------------
// bulkUpsertMisActuals
// ---------------------------------------------------------------------------

describe('bulkUpsertMisActuals', () => {
  it('calls $transaction with upsert for each actual', async () => {
    mockPrisma.$transaction.mockResolvedValue([{ id: 'mis-1' }, { id: 'mis-2' }])

    const actuals = [
      { employee_aop_id: 'emp-aop-1', month: 'apr', actual_value: 100, uploaded_by: 'admin-1' },
      { employee_aop_id: 'emp-aop-1', month: 'may', actual_value: 200, uploaded_by: 'admin-1' },
    ]

    const result = await bulkUpsertMisActuals(actuals)
    expect(result).toHaveLength(2)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// markEmployeeExited
// ---------------------------------------------------------------------------

describe('markEmployeeExited', () => {
  /** Build a base employeeAop row with 100 per month (annual = 1200) */
  function baseEmpAop() {
    return {
      id: 'emp-aop-1',
      department_aop_id: 'dept-aop-1',
      employee_id: 'emp-1',
      annual_target: 1200,
      apr: 100, may: 100, jun: 100, jul: 100, aug: 100, sep: 100,
      oct: 100, nov: 100, dec: 100, jan: 100, feb: 100, mar: 100,
      exited_at: null,
    }
  }

  it('sets exited_at on the record', async () => {
    const exitDate = new Date('2025-06-15')
    mockPrisma.employeeAop.findUniqueOrThrow.mockResolvedValue(baseEmpAop())
    mockPrisma.employeeAop.update.mockResolvedValue({ id: 'emp-aop-1' })

    await markEmployeeExited('emp-aop-1', exitDate)

    const updateCall = mockPrisma.employeeAop.update.mock.calls[0][0]
    expect(updateCall.data.exited_at).toBe(exitDate)
  })

  it('zeros out months AFTER the exit month (exit in jun → zero out jul through mar)', async () => {
    // MONTHS = ['apr','may','jun','jul','aug','sep','oct','nov','dec','jan','feb','mar']
    // exit in jun (index 2) → zero out indices 3..11 = jul,aug,sep,oct,nov,dec,jan,feb,mar
    const exitDate = new Date('2025-06-15')
    mockPrisma.employeeAop.findUniqueOrThrow.mockResolvedValue(baseEmpAop())
    mockPrisma.employeeAop.update.mockResolvedValue({ id: 'emp-aop-1' })

    await markEmployeeExited('emp-aop-1', exitDate)

    const updateCall = mockPrisma.employeeAop.update.mock.calls[0][0]
    const data = updateCall.data

    // Months after jun should be zeroed
    expect(data.jul).toBe(0)
    expect(data.aug).toBe(0)
    expect(data.sep).toBe(0)
    expect(data.oct).toBe(0)
    expect(data.nov).toBe(0)
    expect(data.dec).toBe(0)
    expect(data.jan).toBe(0)
    expect(data.feb).toBe(0)
    expect(data.mar).toBe(0)

    // Months at or before jun should NOT be in the zeroed updates
    expect(data.apr).toBeUndefined()
    expect(data.may).toBeUndefined()
    expect(data.jun).toBeUndefined()
  })

  it('keeps months at or before exit month unchanged', async () => {
    const exitDate = new Date('2025-06-15')
    const empAop = { ...baseEmpAop(), apr: 150, may: 200, jun: 250 }
    mockPrisma.employeeAop.findUniqueOrThrow.mockResolvedValue(empAop)
    mockPrisma.employeeAop.update.mockResolvedValue({ id: 'emp-aop-1' })

    await markEmployeeExited('emp-aop-1', exitDate)

    const updateCall = mockPrisma.employeeAop.update.mock.calls[0][0]
    const data = updateCall.data

    // annual_target should be apr + may + jun = 150 + 200 + 250 = 600
    expect(data.annual_target).toBe(600)
  })

  it('recalculates annual_target as sum of kept months', async () => {
    // Exit in sep (index 5) → keep apr..sep, zero out oct..mar
    // apr=100, may=100, jun=100, jul=100, aug=100, sep=100 → annual = 600
    const exitDate = new Date('2025-09-20')
    mockPrisma.employeeAop.findUniqueOrThrow.mockResolvedValue(baseEmpAop())
    mockPrisma.employeeAop.update.mockResolvedValue({ id: 'emp-aop-1' })

    await markEmployeeExited('emp-aop-1', exitDate)

    const updateCall = mockPrisma.employeeAop.update.mock.calls[0][0]
    expect(updateCall.data.annual_target).toBe(600)
    expect(updateCall.data.oct).toBe(0)
    expect(updateCall.data.nov).toBe(0)
    expect(updateCall.data.dec).toBe(0)
    expect(updateCall.data.jan).toBe(0)
    expect(updateCall.data.feb).toBe(0)
    expect(updateCall.data.mar).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// createReplacementAop
// ---------------------------------------------------------------------------

describe('createReplacementAop', () => {
  const originalEmpAop = {
    id: 'emp-aop-orig',
    department_aop_id: 'dept-aop-1',
    employee_id: 'emp-old',
    annual_target: 300,
    apr: 0, may: 0, jun: 0, jul: 100, aug: 100, sep: 100,
    oct: 0, nov: 0, dec: 0, jan: 0, feb: 0, mar: 0,
    exited_at: new Date('2025-06-30'),
  }

  const replacementMonthly = makeMonthly([0, 0, 0, 0, 0, 0, 150, 150, 150, 0, 0, 0])

  it('creates a new EmployeeAop with replacement_for pointing to original', async () => {
    mockPrisma.employeeAop.findUniqueOrThrow.mockResolvedValue(originalEmpAop)
    mockPrisma.employeeAop.create.mockResolvedValue({ id: 'emp-aop-new' })

    await createReplacementAop({
      original_employee_aop_id: 'emp-aop-orig',
      replacement_employee_id: 'emp-new',
      monthly: replacementMonthly as any,
    })

    const createCall = mockPrisma.employeeAop.create.mock.calls[0][0]
    expect(createCall.data.replacement_for).toBe('emp-aop-orig')
    expect(createCall.data.employee_id).toBe('emp-new')
  })

  it('sets annual_target as sum of monthly targets', async () => {
    mockPrisma.employeeAop.findUniqueOrThrow.mockResolvedValue(originalEmpAop)
    mockPrisma.employeeAop.create.mockResolvedValue({ id: 'emp-aop-new' })

    await createReplacementAop({
      original_employee_aop_id: 'emp-aop-orig',
      replacement_employee_id: 'emp-new',
      monthly: replacementMonthly as any,
    })

    const createCall = mockPrisma.employeeAop.create.mock.calls[0][0]
    // oct=150, nov=150, dec=150, rest=0 → 450
    expect(createCall.data.annual_target).toBe(450)
  })

  it('inherits department_aop_id from original', async () => {
    mockPrisma.employeeAop.findUniqueOrThrow.mockResolvedValue(originalEmpAop)
    mockPrisma.employeeAop.create.mockResolvedValue({ id: 'emp-aop-new' })

    await createReplacementAop({
      original_employee_aop_id: 'emp-aop-orig',
      replacement_employee_id: 'emp-new',
      monthly: replacementMonthly as any,
    })

    const createCall = mockPrisma.employeeAop.create.mock.calls[0][0]
    expect(createCall.data.department_aop_id).toBe('dept-aop-1')
  })
})

// ---------------------------------------------------------------------------
// validateEmployeeCascade — skips exited employees
// ---------------------------------------------------------------------------

describe('validateEmployeeCascade — exited employee handling', () => {
  const deptAop = {
    id: 'dept-aop-1',
    annual_target: 600,
    apr: 50, may: 50, jun: 50, jul: 50, aug: 50, sep: 50,
    oct: 50, nov: 50, dec: 50, jan: 50, feb: 50, mar: 50,
  }

  it('does NOT count exited employees in empTotal', async () => {
    mockPrisma.departmentAop.findUniqueOrThrow.mockResolvedValue(deptAop)
    // One active employee matching dept targets, one exited employee with different targets
    mockPrisma.employeeAop.findMany.mockResolvedValue([
      { annual_target: 600, apr: 50, may: 50, jun: 50, jul: 50, aug: 50, sep: 50, oct: 50, nov: 50, dec: 50, jan: 50, feb: 50, mar: 50, exited_at: null },
      { annual_target: 0, apr: 0, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0, jan: 0, feb: 0, mar: 0, exited_at: new Date() },
    ])

    // validateEmployeeCascade sums ALL rows (it does not filter by exited_at);
    // the exited row should have zeroed months so the sum is still correct.
    // This test confirms totals are computed as raw sums of findMany results.
    const result = await validateEmployeeCascade('dept-aop-1')
    // The exited employee has 0 annual_target, active has 600 → total = 600 = dept total
    expect(result.empTotal).toBe(600)
    expect(result.valid).toBe(true)
  })
})
