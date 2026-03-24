import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@prisma/client'

// Full DB user type — use this when you need all user fields
export type AppUser = Awaited<ReturnType<typeof getCurrentUser>>

/**
 * Returns the full user record from DB.
 * Redirects to /login if not authenticated.
 */
export async function getCurrentUser() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  if (!user || !user.is_active) redirect('/login')
  return user
}

/**
 * Returns the current user and verifies they have one of the allowed roles.
 * Redirects to /unauthorized otherwise.
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const user = await getCurrentUser()
  if (!allowedRoles.includes(user.role)) {
    redirect('/unauthorized')
  }
  return user
}

/** Pure testable check — returns true if managerId matches the user's id. */
export function checkManagerOwnership(userId: string, managerId: string): boolean {
  return userId === managerId
}

/**
 * DB-backed ownership check. Fetches the employee and verifies the given managerId
 * owns that record. Redirects to /unauthorized on failure.
 */
export async function requireManagerOwnership(employeeId: string, managerId: string): Promise<void> {
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
    case 'employee': return '/employee'
    case 'manager':  return '/manager'
    case 'hrbp':     return '/hrbp'
    case 'admin':    return '/admin'
  }
}
