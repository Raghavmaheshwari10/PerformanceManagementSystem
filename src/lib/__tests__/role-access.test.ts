import { vi, describe, it, expect, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — must be declared BEFORE importing the functions under test
// ---------------------------------------------------------------------------

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), count: vi.fn() },
  },
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

// Also mock React cache so getCurrentUser doesn't actually cache across tests
vi.mock('react', () => ({
  cache: (fn: Function) => fn,
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import {
  requireRole,
  requireManagerOwnership,
  getRoleDashboardPath,
} from '@/lib/auth'
import {
  getTransitionRequirements,
  getRevertRequirements,
  STATUS_ORDER,
} from '@/lib/cycle-machine'
import {
  makeAdmin,
  makeManager,
  makeEmployee,
  makeHrbp,
} from '@/test/helpers'

import type { UserRole, CycleStatus } from '@/lib/types'

// ---------------------------------------------------------------------------
// Typed references for the mocked functions
// ---------------------------------------------------------------------------

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>
const mockCount = prisma.user.count as ReturnType<typeof vi.fn>
const mockRedirect = redirect as unknown as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set up mocks so getCurrentUser returns a DB user with the given role. */
function mockSession(user: ReturnType<typeof makeAdmin>) {
  mockAuth.mockResolvedValue({ user: { id: user.id } })
  mockFindUnique.mockResolvedValue(user)
}

/**
 * Expect a call to throw a redirect error with the given URL.
 * Returns the error so callers can do further assertions if needed.
 */
async function expectRedirect(fn: () => Promise<unknown>, url: string) {
  try {
    await fn()
    // If we get here, no redirect was thrown — fail the test
    expect.unreachable('Expected redirect to be called')
  } catch (err) {
    expect((err as Error).message).toBe(`REDIRECT:${url}`)
  }
}

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// Suite 1: requireRole — direct role match
// ===========================================================================

describe('requireRole - direct role match', () => {
  it('admin accessing admin-only route returns user', async () => {
    const admin = makeAdmin()
    mockSession(admin)

    const result = await requireRole(['admin'])
    expect(result).toMatchObject({ id: admin.id, role: 'admin' })
  })

  it('hrbp accessing hrbp-only route returns user', async () => {
    const hrbp = makeHrbp()
    mockSession(hrbp)

    const result = await requireRole(['hrbp'])
    expect(result).toMatchObject({ id: hrbp.id, role: 'hrbp' })
  })

  it('employee accessing employee route returns user', async () => {
    const emp = makeEmployee()
    mockSession(emp)

    const result = await requireRole(['employee'])
    expect(result).toMatchObject({ id: emp.id, role: 'employee' })
  })

  it('manager accessing manager route returns user', async () => {
    const mgr = makeManager()
    mockSession(mgr)

    const result = await requireRole(['manager'])
    expect(result).toMatchObject({ id: mgr.id, role: 'manager' })
  })

  it('employee accessing admin route redirects to /unauthorized', async () => {
    const emp = makeEmployee()
    mockSession(emp)
    // No direct reports either
    mockCount.mockResolvedValue(0)

    await expectRedirect(() => requireRole(['admin']), '/unauthorized')
  })

  it('manager accessing admin route redirects to /unauthorized', async () => {
    const mgr = makeManager()
    mockSession(mgr)

    await expectRedirect(() => requireRole(['admin']), '/unauthorized')
  })

  it('employee accessing hrbp route redirects to /unauthorized', async () => {
    const emp = makeEmployee()
    mockSession(emp)
    mockCount.mockResolvedValue(0)

    await expectRedirect(() => requireRole(['hrbp']), '/unauthorized')
  })
})

// ===========================================================================
// Suite 2: requireRole — multi-role escalation
// ===========================================================================

describe('requireRole - multi-role escalation', () => {
  it('manager can access employee pages', async () => {
    const mgr = makeManager()
    mockSession(mgr)

    const result = await requireRole(['employee'])
    expect(result).toMatchObject({ id: mgr.id, role: 'manager' })
  })

  it('hrbp can access employee pages', async () => {
    const hrbp = makeHrbp()
    mockSession(hrbp)

    const result = await requireRole(['employee'])
    expect(result).toMatchObject({ id: hrbp.id, role: 'hrbp' })
  })

  it('admin can access employee pages', async () => {
    const admin = makeAdmin()
    mockSession(admin)

    const result = await requireRole(['employee'])
    expect(result).toMatchObject({ id: admin.id, role: 'admin' })
  })

  it('employee with no direct reports cannot access manager pages', async () => {
    const emp = makeEmployee()
    mockSession(emp)
    mockCount.mockResolvedValue(0)

    await expectRedirect(() => requireRole(['manager']), '/unauthorized')
  })

  it('employee with direct reports CAN access manager pages', async () => {
    const emp = makeEmployee({ id: 'emp-with-reports' })
    mockSession(emp)
    mockCount.mockResolvedValue(2)

    const result = await requireRole(['manager'])
    expect(result).toMatchObject({ id: 'emp-with-reports', role: 'employee' })
  })
})

// ===========================================================================
// Suite 3: requireRole — inactive / missing user
// ===========================================================================

describe('requireRole - inactive/missing user', () => {
  it('redirects to /login when no session exists', async () => {
    mockAuth.mockResolvedValue(null)

    await expectRedirect(() => requireRole(['employee']), '/login')
  })

  it('redirects to /login when session has no user id', async () => {
    mockAuth.mockResolvedValue({ user: {} })

    await expectRedirect(() => requireRole(['employee']), '/login')
  })

  it('redirects to /login when user is not found in DB', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'ghost-id' } })
    mockFindUnique.mockResolvedValue(null)

    await expectRedirect(() => requireRole(['employee']), '/login')
  })

  it('redirects to /login when user is inactive', async () => {
    const inactive = makeEmployee({ is_active: false })
    mockAuth.mockResolvedValue({ user: { id: inactive.id } })
    mockFindUnique.mockResolvedValue(inactive)

    await expectRedirect(() => requireRole(['employee']), '/login')
  })
})

// ===========================================================================
// Suite 4: requireManagerOwnership
// ===========================================================================

describe('requireManagerOwnership', () => {
  it('passes when manager owns the employee', async () => {
    const mgr = makeManager({ id: 'mgr-1' })
    const emp = makeEmployee({ id: 'emp-1', manager_id: 'mgr-1' })

    // First call: find the caller (manager)
    // Second call: find the employee
    mockFindUnique
      .mockResolvedValueOnce({ role: mgr.role })     // caller lookup
      .mockResolvedValueOnce({ manager_id: emp.manager_id }) // employee lookup

    // Should NOT throw
    await requireManagerOwnership('emp-1', 'mgr-1')
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('redirects when manager does NOT own the employee', async () => {
    mockFindUnique
      .mockResolvedValueOnce({ role: 'manager' })         // caller is a manager
      .mockResolvedValueOnce({ manager_id: 'other-mgr' }) // employee belongs to someone else

    await expectRedirect(
      () => requireManagerOwnership('emp-1', 'mgr-1'),
      '/unauthorized',
    )
  })

  it('admin bypasses ownership check', async () => {
    mockFindUnique.mockResolvedValueOnce({ role: 'admin' })

    await requireManagerOwnership('any-emp', 'admin-1')
    expect(mockRedirect).not.toHaveBeenCalled()
    // findUnique should only have been called once (for the caller), not for the employee
    expect(mockFindUnique).toHaveBeenCalledTimes(1)
  })

  it('hrbp bypasses ownership check', async () => {
    mockFindUnique.mockResolvedValueOnce({ role: 'hrbp' })

    await requireManagerOwnership('any-emp', 'hrbp-1')
    expect(mockRedirect).not.toHaveBeenCalled()
    expect(mockFindUnique).toHaveBeenCalledTimes(1)
  })

  it('redirects when employee is not found', async () => {
    mockFindUnique
      .mockResolvedValueOnce({ role: 'manager' }) // caller
      .mockResolvedValueOnce(null)                 // employee not found

    await expectRedirect(
      () => requireManagerOwnership('nonexistent', 'mgr-1'),
      '/unauthorized',
    )
  })
})

// ===========================================================================
// Suite 5: getRoleDashboardPath
// ===========================================================================

describe('getRoleDashboardPath', () => {
  const cases: [UserRole, string][] = [
    ['admin', '/admin'],
    ['manager', '/manager'],
    ['employee', '/employee'],
    ['hrbp', '/hrbp'],
  ]

  it.each(cases)('%s → %s', (role, expected) => {
    expect(getRoleDashboardPath(role)).toBe(expected)
  })
})

// ===========================================================================
// Suite 6: Cycle transition role matrix
// ===========================================================================

describe('Cycle transition role matrix', () => {
  describe('forward transitions', () => {
    it('draft → kpi_setting is allowed for admin and hrbp', () => {
      const rule = getTransitionRequirements('draft', 'kpi_setting')
      expect(rule).not.toBeNull()
      expect(rule!.allowedRoles).toContain('admin')
      expect(rule!.allowedRoles).toContain('hrbp')
    })

    it('kpi_setting → self_review is allowed for admin and hrbp', () => {
      const rule = getTransitionRequirements('kpi_setting', 'self_review')
      expect(rule).not.toBeNull()
      expect(rule!.allowedRoles).toContain('admin')
      expect(rule!.allowedRoles).toContain('hrbp')
    })

    it('self_review → manager_review is allowed for admin and hrbp', () => {
      const rule = getTransitionRequirements('self_review', 'manager_review')
      expect(rule).not.toBeNull()
      expect(rule!.allowedRoles).toContain('admin')
      expect(rule!.allowedRoles).toContain('hrbp')
    })

    it('manager_review → calibrating is allowed for admin and hrbp', () => {
      const rule = getTransitionRequirements('manager_review', 'calibrating')
      expect(rule).not.toBeNull()
      expect(rule!.allowedRoles).toContain('admin')
      expect(rule!.allowedRoles).toContain('hrbp')
    })

    it('calibrating → locked is allowed ONLY for hrbp', () => {
      const rule = getTransitionRequirements('calibrating', 'locked')
      expect(rule).not.toBeNull()
      expect(rule!.allowedRoles).toEqual(['hrbp'])
    })

    it('locked → published is allowed ONLY for hrbp', () => {
      const rule = getTransitionRequirements('locked', 'published')
      expect(rule).not.toBeNull()
      expect(rule!.allowedRoles).toEqual(['hrbp'])
    })

    it('no forward transition exists from published', () => {
      // published is the terminal state
      const nextStatuses = STATUS_ORDER.filter((s) => s !== 'published')
      for (const to of nextStatuses) {
        expect(getTransitionRequirements('published', to)).toBeNull()
      }
    })
  })

  describe('revert transitions', () => {
    const revertable: [string, string][] = [
      ['kpi_setting', 'draft'],
      ['self_review', 'kpi_setting'],
      ['manager_review', 'self_review'],
      ['calibrating', 'manager_review'],
      ['locked', 'calibrating'],
    ]

    it.each(revertable)(
      '%s → %s revert is allowed ONLY for admin',
      (from, _to) => {
        const rule = getRevertRequirements(from as CycleStatus)
        expect(rule).not.toBeNull()
        expect(rule!.allowedRoles).toEqual(['admin'])
      },
    )

    it('cannot revert from draft (no previous state)', () => {
      expect(getRevertRequirements('draft')).toBeNull()
    })

    it('cannot revert from published', () => {
      expect(getRevertRequirements('published')).toBeNull()
    })
  })
})
