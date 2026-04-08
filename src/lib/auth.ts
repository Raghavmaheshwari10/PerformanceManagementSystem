import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { cache } from 'react'
import type { UserRole } from '@prisma/client'

// Full DB user type — use this when you need all user fields
export type AppUser = Awaited<ReturnType<typeof getCurrentUser>>

/**
 * Returns the full user record from DB.
 * Cached per-request via React `cache()` — multiple calls in the same
 * render tree (layout + page + components) only hit DB once.
 * Redirects to /login if not authenticated.
 */
export const getCurrentUser = cache(async () => {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!user || !user.is_active) redirect('/login')
  return user
})

/**
 * Returns the current user and verifies they have one of the allowed roles.
 * Supports multi-role: an HRBP/admin with direct reports can access manager pages.
 * A manager can access employee pages (for self-review).
 * Redirects to /unauthorized otherwise.
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const user = await getCurrentUser()

  // Direct role match
  if (allowedRoles.includes(user.role)) return user

  // Multi-role: if 'manager' is allowed, check if user has direct reports
  if (allowedRoles.includes('manager')) {
    const hasReports = await prisma.user.count({
      where: { manager_id: user.id, is_active: true },
    })
    if (hasReports > 0) return user
  }

  // Multi-role: if 'employee' is allowed, managers/HRBPs/admins can access employee pages
  if (allowedRoles.includes('employee')) {
    if (['manager', 'hrbp', 'admin'].includes(user.role)) return user
  }

  redirect('/unauthorized')
}

/** Pure testable check — returns true if managerId matches the user's id. */
export function checkManagerOwnership(userId: string, managerId: string): boolean {
  return userId === managerId
}

/**
 * DB-backed ownership check. Fetches the employee and verifies the given managerId
 * owns that record. Admins and HRBPs bypass the check (they can manage any employee).
 * Redirects to /unauthorized on failure.
 */
export async function requireManagerOwnership(employeeId: string, managerId: string): Promise<void> {
  // Admins and HRBPs can access any employee's pages
  const caller = await prisma.user.findUnique({
    where: { id: managerId },
    select: { role: true },
  })
  if (caller && (caller.role === 'admin' || caller.role === 'hrbp')) return

  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: { manager_id: true },
  })
  if (!employee || employee.manager_id !== managerId) {
    redirect('/unauthorized')
  }
}

export function getRoleDashboardPath(role: UserRole): string {
  switch (role) {
    case 'employee':        return '/employee'
    case 'manager':         return '/manager'
    case 'hrbp':            return '/hrbp'
    case 'department_head': return '/manager'
    case 'founder':         return '/admin/founder'
    case 'superadmin':
    case 'admin':           return '/admin'
  }
}
