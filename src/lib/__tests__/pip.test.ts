import { vi, describe, it, expect, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the functions under test
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    pip: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    pipMilestone: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
    },
    pipCheckIn: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    pipDocument: { create: vi.fn() },
    appraisal: { findMany: vi.fn() },
    cycle: { findFirst: vi.fn(), findUnique: vi.fn() },
    user: { findUnique: vi.fn(), count: vi.fn() },
    hrbpDepartment: { findMany: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({
  requireRole: vi.fn(),
  getCurrentUser: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

vi.mock('react', async () => {
  const actual = await vi.importActual('react')
  return { ...actual, cache: (fn: Function) => fn }
})

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/prisma'
import { requireRole, getCurrentUser } from '@/lib/auth'
import { fetchPipList, fetchPipDetail, fetchPipRecommendations } from '@/lib/db/pip'
import {
  createPip,
  activatePip,
  acknowledgePip,
  extendPip,
  completePip,
  closePip,
  addMilestone,
  updateMilestoneStatus,
  signOffMilestone,
  addCheckIn,
} from '@/app/(dashboard)/admin/pip/actions'
import { makeUser, makeManager, makeHrbp, makeEmployee, makeFormData } from '@/test/helpers'

const mockPrisma = prisma as any
const mockRequireRole = requireRole as ReturnType<typeof vi.fn>
const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const NOW = new Date('2026-04-07T00:00:00.000Z')
const FUTURE = new Date('2026-06-07T00:00:00.000Z')
const PAST = new Date('2026-01-01T00:00:00.000Z')

// Valid UUIDs for Zod validation in server actions
const UUID_EMP = '00000000-0000-4000-8000-000000000001'
const UUID_MGR = '00000000-0000-4000-8000-000000000002'
const UUID_HRBP = '00000000-0000-4000-8000-000000000003'
const UUID_PIP = '00000000-0000-4000-8000-000000000010'
const UUID_MS = '00000000-0000-4000-8000-000000000020'

function makePipRow(overrides: Record<string, any> = {}) {
  return {
    id: 'pip-1',
    employee_id: 'emp-1',
    manager_id: 'mgr-1',
    initiated_by: 'mgr-1',
    hrbp_id: 'hrbp-1',
    skip_level_manager_id: null,
    cycle_id: 'cycle-1',
    reason: 'Below expectations in Q1',
    start_date: PAST,
    end_date: FUTURE,
    status: 'active',
    outcome: null,
    employee_acknowledged_at: null,
    escalation_note: null,
    auto_flag_next_cycle: false,
    created_at: PAST,
    updated_at: NOW,
    employee: {
      id: 'emp-1',
      full_name: 'Alice Employee',
      email: 'alice@test.com',
      designation: 'Engineer',
      department: { name: 'Engineering' },
    },
    manager: { id: 'mgr-1', full_name: 'Bob Manager' },
    initiator: { id: 'mgr-1', full_name: 'Bob Manager' },
    hrbp: { id: 'hrbp-1', full_name: 'Carol HRBP' },
    skip_level_manager: null,
    cycle: { id: 'cycle-1', name: 'Q1 2026' },
    milestones: [],
    check_ins: [],
    documents: [],
    ...overrides,
  }
}

// =========================================================================
// Suite 1: fetchPipList
// =========================================================================

describe('fetchPipList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty array when no PIPs exist', async () => {
    mockPrisma.pip.findMany.mockResolvedValue([])
    const result = await fetchPipList()
    expect(result).toEqual([])
  })

  it('returns PIPs with correct shape', async () => {
    mockPrisma.pip.findMany.mockResolvedValue([makePipRow()])
    const result = await fetchPipList()

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'pip-1',
      employeeName: 'Alice Employee',
      department: 'Engineering',
      status: 'active',
    })
    expect(result[0].milestoneProgress).toEqual({ total: 0, completed: 0 })
    expect(typeof result[0].daysRemaining).toBe('number')
  })

  it('filters by status correctly', async () => {
    mockPrisma.pip.findMany.mockResolvedValue([])
    await fetchPipList({ status: 'active' })

    const call = mockPrisma.pip.findMany.mock.calls[0][0]
    expect(call.where.status).toBe('active')
  })

  it('filters by managerId correctly', async () => {
    mockPrisma.pip.findMany.mockResolvedValue([])
    await fetchPipList({ managerId: 'mgr-1' })

    const call = mockPrisma.pip.findMany.mock.calls[0][0]
    expect(call.where.manager_id).toBe('mgr-1')
  })

  it('filters by hrbpDepartmentIds correctly', async () => {
    mockPrisma.pip.findMany.mockResolvedValue([])
    await fetchPipList({ hrbpDepartmentIds: ['dept-1', 'dept-2'] })

    const call = mockPrisma.pip.findMany.mock.calls[0][0]
    expect(call.where.employee).toEqual({
      department_id: { in: ['dept-1', 'dept-2'] },
    })
  })

  it('computes daysRemaining and milestoneProgress correctly', async () => {
    const milestones = [
      { id: 'm1', status: 'completed' },
      { id: 'm2', status: 'in_progress' },
      { id: 'm3', status: 'completed' },
    ]
    mockPrisma.pip.findMany.mockResolvedValue([
      makePipRow({ milestones }),
    ])

    const result = await fetchPipList()
    expect(result[0].milestoneProgress).toEqual({ total: 3, completed: 2 })
    expect(result[0].daysRemaining).toBeGreaterThanOrEqual(0)
  })
})

// =========================================================================
// Suite 2: fetchPipDetail
// =========================================================================

describe('fetchPipDetail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns full PIP with milestones, check-ins, documents', async () => {
    const row = makePipRow({
      milestones: [
        {
          id: 'm1',
          title: 'Improve code quality',
          description: null,
          target_metric: '90% coverage',
          due_date: FUTURE,
          status: 'pending',
          hrbp_signed_off_at: null,
          hrbp_signed_off_by: null,
          sort_order: 0,
        },
      ],
      check_ins: [
        {
          id: 'ci-1',
          creator: { id: 'mgr-1', full_name: 'Bob Manager' },
          check_in_date: NOW,
          progress_rating: 3,
          notes: 'Some progress',
          next_steps: 'Continue',
          employee_response: null,
          created_at: NOW,
        },
      ],
      documents: [
        {
          id: 'doc-1',
          uploader: { id: 'mgr-1', full_name: 'Bob Manager' },
          file_name: 'plan.pdf',
          file_url: '/files/plan.pdf',
          file_type: 'application/pdf',
          description: null,
          created_at: NOW,
        },
      ],
    })
    mockPrisma.pip.findUnique.mockResolvedValue(row)

    const detail = await fetchPipDetail('pip-1')
    expect(detail).not.toBeNull()
    expect(detail!.milestones).toHaveLength(1)
    expect(detail!.milestones[0].title).toBe('Improve code quality')
    expect(detail!.checkIns).toHaveLength(1)
    expect(detail!.checkIns[0].progressRating).toBe(3)
    expect(detail!.documents).toHaveLength(1)
    expect(detail!.documents[0].fileName).toBe('plan.pdf')
  })

  it('returns null for non-existent ID', async () => {
    mockPrisma.pip.findUnique.mockResolvedValue(null)
    const result = await fetchPipDetail('nonexistent')
    expect(result).toBeNull()
  })

  it('includes skip-level manager when available', async () => {
    const row = makePipRow({
      skip_level_manager_id: 'skip-1',
      skip_level_manager: { id: 'skip-1', full_name: 'Director Dave' },
    })
    mockPrisma.pip.findUnique.mockResolvedValue(row)

    const detail = await fetchPipDetail('pip-1')
    expect(detail!.skipLevelManager).toEqual({
      id: 'skip-1',
      fullName: 'Director Dave',
    })
  })
})

// =========================================================================
// Suite 3: fetchPipRecommendations
// =========================================================================

describe('fetchPipRecommendations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns SME/BE rated employees from published cycle', async () => {
    mockPrisma.cycle.findFirst.mockResolvedValue({ id: 'cycle-1', name: 'Q1 2026' })
    mockPrisma.appraisal.findMany.mockResolvedValue([
      {
        employee_id: 'emp-1',
        final_rating: 'SME',
        employee: {
          id: 'emp-1',
          full_name: 'Alice',
          email: 'alice@test.com',
          manager_id: 'mgr-1',
          department: { name: 'Engineering' },
          manager: { full_name: 'Bob' },
        },
      },
    ])
    mockPrisma.pip.findMany.mockResolvedValue([])

    const recs = await fetchPipRecommendations()
    expect(recs).toHaveLength(1)
    expect(recs[0].finalRating).toBe('SME')
    expect(recs[0].employeeName).toBe('Alice')
  })

  it('marks hasActivePip correctly for employees with existing PIP', async () => {
    mockPrisma.cycle.findFirst.mockResolvedValue({ id: 'cycle-1', name: 'Q1 2026' })
    mockPrisma.appraisal.findMany.mockResolvedValue([
      {
        employee_id: 'emp-1',
        final_rating: 'BE',
        employee: {
          id: 'emp-1',
          full_name: 'Alice',
          email: 'alice@test.com',
          manager_id: 'mgr-1',
          department: { name: 'Eng' },
          manager: { full_name: 'Bob' },
        },
      },
    ])
    mockPrisma.pip.findMany.mockResolvedValue([{ employee_id: 'emp-1' }])

    const recs = await fetchPipRecommendations()
    expect(recs[0].hasActivePip).toBe(true)
  })

  it('returns empty array when no published cycle exists', async () => {
    mockPrisma.cycle.findFirst.mockResolvedValue(null)
    const recs = await fetchPipRecommendations()
    expect(recs).toEqual([])
  })
})

// =========================================================================
// Suite 4: PIP Lifecycle (server actions)
// =========================================================================

describe('PIP Lifecycle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createPip creates draft PIP with correct fields', async () => {
    const manager = makeManager({ id: UUID_MGR })
    mockRequireRole.mockResolvedValue(manager)

    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: UUID_EMP, manager_id: UUID_MGR, department_id: 'dept-1' })
      .mockResolvedValueOnce({ manager_id: 'skip-1' })

    mockPrisma.hrbpDepartment.findFirst.mockResolvedValue({ hrbp_id: UUID_HRBP })

    mockPrisma.pip.create.mockResolvedValue({ id: UUID_PIP })
    mockPrisma.auditLog.create.mockResolvedValue({})

    const fd = makeFormData({
      employee_id: UUID_EMP,
      reason: 'Below expectations in multiple areas',
      start_date: '2026-04-01',
      end_date: '2026-06-01',
    })

    const result = await createPip({ data: null, error: null }, fd)
    expect(result.error).toBeNull()
    expect(mockPrisma.pip.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employee_id: UUID_EMP,
        manager_id: UUID_MGR,
        initiated_by: UUID_MGR,
        hrbp_id: UUID_HRBP,
        skip_level_manager_id: 'skip-1',
      }),
    })
  })

  it('activatePip transitions draft to active (HRBP only)', async () => {
    const hrbp = makeHrbp({ id: 'hrbp-1' })
    mockRequireRole.mockResolvedValue(hrbp)
    mockPrisma.pip.findUnique.mockResolvedValue({ id: 'pip-1', status: 'draft' })
    mockPrisma.pip.update.mockResolvedValue({})
    mockPrisma.auditLog.create.mockResolvedValue({})

    const result = await activatePip('pip-1')
    expect(result.error).toBeNull()
    expect(mockPrisma.pip.update).toHaveBeenCalledWith({
      where: { id: 'pip-1' },
      data: { status: 'active' },
    })
  })

  it('acknowledgePip sets timestamp for own PIP', async () => {
    const employee = makeEmployee({ id: 'emp-1' })
    mockGetCurrentUser.mockResolvedValue(employee)
    mockPrisma.pip.findUnique.mockResolvedValue({ id: 'pip-1', employee_id: 'emp-1' })
    mockPrisma.pip.update.mockResolvedValue({})
    mockPrisma.auditLog.create.mockResolvedValue({})

    const result = await acknowledgePip('pip-1')
    expect(result.error).toBeNull()
    expect(mockPrisma.pip.update).toHaveBeenCalledWith({
      where: { id: 'pip-1' },
      data: { employee_acknowledged_at: expect.any(Date) },
    })
  })

  it('extendPip updates end_date and status', async () => {
    const hrbp = makeHrbp({ id: 'hrbp-1' })
    mockRequireRole.mockResolvedValue(hrbp)
    mockPrisma.pip.findUnique.mockResolvedValue({
      id: 'pip-1',
      status: 'active',
      end_date: FUTURE,
    })
    mockPrisma.pip.update.mockResolvedValue({})
    mockPrisma.auditLog.create.mockResolvedValue({})

    const result = await extendPip('pip-1', '2026-08-01')
    expect(result.error).toBeNull()
    expect(mockPrisma.pip.update).toHaveBeenCalledWith({
      where: { id: 'pip-1' },
      data: {
        end_date: expect.any(Date),
        status: 'extended',
      },
    })
  })

  it('completePip requires valid outcome', async () => {
    const hrbp = makeHrbp({ id: 'hrbp-1' })
    mockRequireRole.mockResolvedValue(hrbp)

    const result = await completePip('pip-1', 'invalid_outcome')
    expect(result.error).toBe('Invalid outcome')
  })

  it('closePip with not_improved and auto_flag creates audit log', async () => {
    const hrbp = makeHrbp({ id: 'hrbp-1' })
    mockRequireRole.mockResolvedValue(hrbp)
    mockPrisma.pip.findUnique.mockResolvedValue({
      id: 'pip-1',
      status: 'completed',
      outcome: 'not_improved',
      auto_flag_next_cycle: true,
      employee_id: 'emp-1',
    })
    mockPrisma.pip.update.mockResolvedValue({})
    mockPrisma.auditLog.create.mockResolvedValue({})

    const result = await closePip('pip-1')
    expect(result.error).toBeNull()

    // Should have 2 audit log calls: auto-flag + closed
    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(2)
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'pip_auto_flag_next_cycle',
        new_value: { employeeId: 'emp-1' },
      }),
    })
  })
})

// =========================================================================
// Suite 5: Milestone & Check-in Operations
// =========================================================================

describe('Milestone & Check-in Operations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('addMilestone creates milestone with auto sort_order', async () => {
    const manager = makeManager({ id: UUID_MGR })
    mockRequireRole.mockResolvedValue(manager)
    mockPrisma.pipMilestone.aggregate.mockResolvedValue({ _max: { sort_order: 2 } })
    mockPrisma.pipMilestone.create.mockResolvedValue({ id: UUID_MS })
    mockPrisma.auditLog.create.mockResolvedValue({})

    const fd = makeFormData({
      pip_id: UUID_PIP,
      title: 'Code quality improvement',
      target_metric: 'Achieve 90% test coverage',
      due_date: '2026-05-15',
    })

    const result = await addMilestone({ data: null, error: null }, fd)
    expect(result.error).toBeNull()
    expect(mockPrisma.pipMilestone.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        pip_id: UUID_PIP,
        sort_order: 3,
      }),
    })
  })

  it('updateMilestoneStatus changes milestone status', async () => {
    const manager = makeManager({ id: 'mgr-1' })
    mockRequireRole.mockResolvedValue(manager)
    mockPrisma.pipMilestone.findUnique.mockResolvedValue({ id: 'ms-1', status: 'pending' })
    mockPrisma.pipMilestone.update.mockResolvedValue({})
    mockPrisma.auditLog.create.mockResolvedValue({})

    const result = await updateMilestoneStatus('ms-1', 'completed')
    expect(result.error).toBeNull()
    expect(mockPrisma.pipMilestone.update).toHaveBeenCalledWith({
      where: { id: 'ms-1' },
      data: { status: 'completed' },
    })
  })

  it('signOffMilestone sets HRBP sign-off fields', async () => {
    const hrbp = makeHrbp({ id: 'hrbp-1' })
    mockRequireRole.mockResolvedValue(hrbp)
    mockPrisma.pipMilestone.findUnique.mockResolvedValue({ id: 'ms-1' })
    mockPrisma.pipMilestone.update.mockResolvedValue({})
    mockPrisma.auditLog.create.mockResolvedValue({})

    const result = await signOffMilestone('ms-1')
    expect(result.error).toBeNull()
    expect(mockPrisma.pipMilestone.update).toHaveBeenCalledWith({
      where: { id: 'ms-1' },
      data: {
        hrbp_signed_off_at: expect.any(Date),
        hrbp_signed_off_by: 'hrbp-1',
      },
    })
  })

  it('addCheckIn creates check-in record', async () => {
    const manager = makeManager({ id: UUID_MGR })
    mockRequireRole.mockResolvedValue(manager)
    mockPrisma.pipCheckIn.create.mockResolvedValue({ id: 'ci-new' })
    mockPrisma.auditLog.create.mockResolvedValue({})

    const fd = makeFormData({
      pip_id: UUID_PIP,
      check_in_date: '2026-04-15',
      progress_rating: '3',
      notes: 'Good progress on code quality',
    })

    const result = await addCheckIn({ data: null, error: null }, fd)
    expect(result.error).toBeNull()
    expect(mockPrisma.pipCheckIn.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        pip_id: UUID_PIP,
        created_by: UUID_MGR,
        progress_rating: 3,
      }),
    })
  })
})

// =========================================================================
// Suite 6: Role Enforcement
// =========================================================================

describe('Role Enforcement', () => {
  beforeEach(() => vi.clearAllMocks())

  it('manager can create PIP for direct report', async () => {
    const manager = makeManager({ id: UUID_MGR })
    mockRequireRole.mockResolvedValue(manager)
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ id: UUID_EMP, manager_id: UUID_MGR, department_id: 'dept-1' })
      .mockResolvedValueOnce({ manager_id: null })
    mockPrisma.hrbpDepartment.findFirst.mockResolvedValue({ hrbp_id: UUID_HRBP })
    mockPrisma.pip.create.mockResolvedValue({ id: UUID_PIP })
    mockPrisma.auditLog.create.mockResolvedValue({})

    const fd = makeFormData({
      employee_id: UUID_EMP,
      reason: 'Performance improvement needed for Q1',
      start_date: '2026-04-01',
      end_date: '2026-06-01',
    })

    const result = await createPip({ data: null, error: null }, fd)
    expect(result.error).toBeNull()
  })

  it('HRBP can activate PIP', async () => {
    const hrbp = makeHrbp({ id: 'hrbp-1' })
    mockRequireRole.mockResolvedValue(hrbp)
    mockPrisma.pip.findUnique.mockResolvedValue({ id: 'pip-1', status: 'draft' })
    mockPrisma.pip.update.mockResolvedValue({})
    mockPrisma.auditLog.create.mockResolvedValue({})

    const result = await activatePip('pip-1')
    expect(result.error).toBeNull()
    expect(mockRequireRole).toHaveBeenCalledWith(['hrbp'])
  })

  it('employee can acknowledge own PIP but not others', async () => {
    const employee = makeEmployee({ id: 'emp-1' })
    mockGetCurrentUser.mockResolvedValue(employee)

    // Own PIP - should succeed
    mockPrisma.pip.findUnique.mockResolvedValue({ id: 'pip-1', employee_id: 'emp-1' })
    mockPrisma.pip.update.mockResolvedValue({})
    mockPrisma.auditLog.create.mockResolvedValue({})
    const ownResult = await acknowledgePip('pip-1')
    expect(ownResult.error).toBeNull()

    // Other's PIP - should fail
    mockPrisma.pip.findUnique.mockResolvedValue({ id: 'pip-2', employee_id: 'emp-2' })
    const otherResult = await acknowledgePip('pip-2')
    expect(otherResult.error).toBe('You can only acknowledge your own PIP')
  })

  it('employee cannot create or activate PIPs', async () => {
    // requireRole throws redirect for unauthorized roles
    mockRequireRole.mockRejectedValue(new Error('REDIRECT:/unauthorized'))

    const fd = makeFormData({
      employee_id: UUID_EMP,
      reason: 'Should not work from employee role',
      start_date: '2026-04-01',
      end_date: '2026-06-01',
    })

    await expect(createPip({ data: null, error: null }, fd)).rejects.toThrow('REDIRECT')
    await expect(activatePip('pip-1')).rejects.toThrow('REDIRECT')
  })
})
