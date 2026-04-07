import { vi, describe, it, expect, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the functions under test
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  prisma: {
    kpi: { findUnique: vi.fn() },
    kpiComment: { create: vi.fn(), findMany: vi.fn() },
    notification: { create: vi.fn() },
  },
}))

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/cycle-helpers', () => ({
  getStatusForEmployee: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getStatusForEmployee } from '@/lib/cycle-helpers'
import {
  addKpiComment,
  fetchKpiComments,
} from '@/app/(dashboard)/shared/kpi-comment-actions'

// Typed mock references
const mockPrisma = prisma as any
const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>
const mockGetStatus = getStatusForEmployee as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_EMPLOYEE = {
  id: 'emp-1',
  full_name: 'Alice Employee',
  role: 'employee',
}

const USER_MANAGER = {
  id: 'mgr-1',
  full_name: 'Bob Manager',
  role: 'manager',
}

const KPI_ROW = {
  id: 'kpi-1',
  title: 'Improve code quality',
  cycle_id: 'cycle-1',
  employee_id: 'emp-1',
  manager_id: 'mgr-1',
}

function setupDefaults(
  user = USER_EMPLOYEE,
  status = 'self_review' as string,
) {
  mockGetCurrentUser.mockResolvedValue(user)
  mockPrisma.kpi.findUnique.mockResolvedValue(KPI_ROW)
  mockGetStatus.mockResolvedValue(status)
  mockPrisma.kpiComment.create.mockResolvedValue({ id: 'comment-1' })
  mockPrisma.notification.create.mockResolvedValue({})
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('addKpiComment validation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects empty body', async () => {
    setupDefaults()
    const result = await addKpiComment('kpi-1', '   ')
    expect(result.error).toBe('Comment cannot be empty')
    expect(result.data).toBeNull()
  })

  it('rejects body over 2000 chars', async () => {
    setupDefaults()
    const longBody = 'x'.repeat(2001)
    const result = await addKpiComment('kpi-1', longBody)
    expect(result.error).toBe('Comment too long (max 2000 characters)')
    expect(result.data).toBeNull()
  })

  it('rejects when KPI not found', async () => {
    mockGetCurrentUser.mockResolvedValue(USER_EMPLOYEE)
    mockPrisma.kpi.findUnique.mockResolvedValue(null)

    const result = await addKpiComment('nonexistent', 'Hello')
    expect(result.error).toBe('KPI not found')
  })

  it('rejects when user is not employee or manager of the KPI', async () => {
    const outsider = { id: 'outsider-1', full_name: 'Eve Outsider', role: 'employee' }
    mockGetCurrentUser.mockResolvedValue(outsider)
    mockPrisma.kpi.findUnique.mockResolvedValue(KPI_ROW)

    const result = await addKpiComment('kpi-1', 'Hello')
    expect(result.error).toBe('Only the KPI employee or manager can comment')
  })

  it('rejects when cycle status is kpi_setting', async () => {
    setupDefaults(USER_EMPLOYEE, 'kpi_setting')
    const result = await addKpiComment('kpi-1', 'Hello')
    expect(result.error).toBe(
      'Comments are only allowed during self-review and manager review phases',
    )
  })

  it('rejects when cycle status is calibrating', async () => {
    setupDefaults(USER_EMPLOYEE, 'calibrating')
    const result = await addKpiComment('kpi-1', 'Hello')
    expect(result.error).toBe(
      'Comments are only allowed during self-review and manager review phases',
    )
  })
})

describe('addKpiComment success', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates comment when employee comments during self_review', async () => {
    setupDefaults(USER_EMPLOYEE, 'self_review')

    const result = await addKpiComment('kpi-1', 'My progress update')
    expect(result.error).toBeNull()
    expect(result.data).toEqual({ id: 'comment-1' })
    expect(mockPrisma.kpiComment.create).toHaveBeenCalledWith({
      data: {
        kpi_id: 'kpi-1',
        author_id: 'emp-1',
        body: 'My progress update',
      },
      select: { id: true },
    })
  })

  it('creates comment when manager comments during manager_review', async () => {
    setupDefaults(USER_MANAGER, 'manager_review')

    const result = await addKpiComment('kpi-1', 'Looks good')
    expect(result.error).toBeNull()
    expect(result.data).toEqual({ id: 'comment-1' })
    expect(mockPrisma.kpiComment.create).toHaveBeenCalledWith({
      data: {
        kpi_id: 'kpi-1',
        author_id: 'mgr-1',
        body: 'Looks good',
      },
      select: { id: true },
    })
  })

  it('creates notification for the manager when employee comments', async () => {
    setupDefaults(USER_EMPLOYEE, 'self_review')

    await addKpiComment('kpi-1', 'Update')
    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: {
        recipient_id: 'mgr-1',
        type: 'kpi_comment',
        payload: {
          kpi_id: 'kpi-1',
          kpi_title: 'Improve code quality',
          commenter_name: 'Alice Employee',
          cycle_id: 'cycle-1',
        },
      },
    })
  })

  it('creates notification for the employee when manager comments', async () => {
    setupDefaults(USER_MANAGER, 'manager_review')

    await addKpiComment('kpi-1', 'Feedback')
    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: {
        recipient_id: 'emp-1',
        type: 'kpi_comment',
        payload: {
          kpi_id: 'kpi-1',
          kpi_title: 'Improve code quality',
          commenter_name: 'Bob Manager',
          cycle_id: 'cycle-1',
        },
      },
    })
  })

  it('trims whitespace from body', async () => {
    setupDefaults(USER_EMPLOYEE, 'self_review')

    await addKpiComment('kpi-1', '  trimmed comment  ')
    expect(mockPrisma.kpiComment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ body: 'trimmed comment' }),
      select: { id: true },
    })
  })
})

describe('fetchKpiComments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns comments ordered by created_at asc', async () => {
    const comments = [
      {
        id: 'c-1',
        body: 'First',
        created_at: new Date('2026-04-01'),
        author: { id: 'emp-1', full_name: 'Alice Employee', role: 'employee' },
      },
      {
        id: 'c-2',
        body: 'Second',
        created_at: new Date('2026-04-02'),
        author: { id: 'mgr-1', full_name: 'Bob Manager', role: 'manager' },
      },
    ]
    mockPrisma.kpiComment.findMany.mockResolvedValue(comments)

    const result = await fetchKpiComments('kpi-1')
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('c-1')
    expect(result[1].id).toBe('c-2')

    expect(mockPrisma.kpiComment.findMany).toHaveBeenCalledWith({
      where: { kpi_id: 'kpi-1' },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        body: true,
        created_at: true,
        author: {
          select: {
            id: true,
            full_name: true,
            role: true,
          },
        },
      },
    })
  })

  it('returns empty array when no comments exist', async () => {
    mockPrisma.kpiComment.findMany.mockResolvedValue([])
    const result = await fetchKpiComments('kpi-1')
    expect(result).toEqual([])
  })

  it('includes author id, full_name, and role', async () => {
    const comments = [
      {
        id: 'c-1',
        body: 'Test',
        created_at: new Date('2026-04-01'),
        author: { id: 'emp-1', full_name: 'Alice Employee', role: 'employee' },
      },
    ]
    mockPrisma.kpiComment.findMany.mockResolvedValue(comments)

    const result = await fetchKpiComments('kpi-1')
    expect(result[0].author).toEqual({
      id: 'emp-1',
      full_name: 'Alice Employee',
      role: 'employee',
    })
  })
})

describe('Phase gating', () => {
  beforeEach(() => vi.clearAllMocks())

  it('allows comments in self_review phase', async () => {
    setupDefaults(USER_EMPLOYEE, 'self_review')
    const result = await addKpiComment('kpi-1', 'Allowed')
    expect(result.error).toBeNull()
    expect(result.data).toEqual({ id: 'comment-1' })
  })

  it('allows comments in manager_review phase', async () => {
    setupDefaults(USER_MANAGER, 'manager_review')
    const result = await addKpiComment('kpi-1', 'Allowed')
    expect(result.error).toBeNull()
    expect(result.data).toEqual({ id: 'comment-1' })
  })

  it('blocks comments in kpi_setting phase', async () => {
    setupDefaults(USER_EMPLOYEE, 'kpi_setting')
    const result = await addKpiComment('kpi-1', 'Blocked')
    expect(result.error).toBe(
      'Comments are only allowed during self-review and manager review phases',
    )
  })

  it('blocks comments in calibrating phase', async () => {
    setupDefaults(USER_EMPLOYEE, 'calibrating')
    const result = await addKpiComment('kpi-1', 'Blocked')
    expect(result.error).toBe(
      'Comments are only allowed during self-review and manager review phases',
    )
  })

  it('blocks comments in published phase', async () => {
    setupDefaults(USER_EMPLOYEE, 'published')
    const result = await addKpiComment('kpi-1', 'Blocked')
    expect(result.error).toBe(
      'Comments are only allowed during self-review and manager review phases',
    )
  })
})
