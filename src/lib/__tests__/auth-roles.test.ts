import { vi, describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks — auth.ts imports auth() and prisma; we stub them out so the
// module can load in a plain Node/Vitest environment without Next.js.
// ---------------------------------------------------------------------------

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), count: vi.fn() },
  },
}))

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { getRoleDashboardPath, checkManagerOwnership } from '@/lib/auth'

// ---------------------------------------------------------------------------
// getRoleDashboardPath
// ---------------------------------------------------------------------------

describe('getRoleDashboardPath', () => {
  it('returns /employee for role employee', () => {
    expect(getRoleDashboardPath('employee')).toBe('/employee')
  })

  it('returns /manager for role manager', () => {
    expect(getRoleDashboardPath('manager')).toBe('/manager')
  })

  it('returns /hrbp for role hrbp', () => {
    expect(getRoleDashboardPath('hrbp')).toBe('/hrbp')
  })

  it('returns /admin for role admin', () => {
    expect(getRoleDashboardPath('admin')).toBe('/admin')
  })

  it('returns /admin for role superadmin', () => {
    expect(getRoleDashboardPath('superadmin')).toBe('/admin')
  })

  it('returns /department-head for role department_head', () => {
    expect(getRoleDashboardPath('department_head')).toBe('/department-head')
  })

  it('returns /admin/founder for role founder', () => {
    expect(getRoleDashboardPath('founder')).toBe('/admin/founder')
  })
})

// ---------------------------------------------------------------------------
// checkManagerOwnership
// ---------------------------------------------------------------------------

describe('checkManagerOwnership', () => {
  it('returns true when userId and managerId are the same', () => {
    expect(checkManagerOwnership('user-123', 'user-123')).toBe(true)
  })

  it('returns false when userId and managerId are different', () => {
    expect(checkManagerOwnership('user-123', 'user-456')).toBe(false)
  })

  it('returns false for empty string mismatch', () => {
    expect(checkManagerOwnership('', 'user-1')).toBe(false)
  })

  it('returns true for two identical empty strings', () => {
    expect(checkManagerOwnership('', '')).toBe(true)
  })
})
