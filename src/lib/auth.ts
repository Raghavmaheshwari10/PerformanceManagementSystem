import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { User, UserRole } from './types'

export async function getCurrentUser(): Promise<User> {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: dbUser, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', authUser.email)
    .single()

  if (error || !dbUser) redirect('/login')
  return dbUser as User
}

export async function requireRole(allowedRoles: UserRole[]): Promise<User> {
  const user = await getCurrentUser()
  if (!allowedRoles.includes(user.role)) {
    redirect('/unauthorized')
  }
  return user
}

export function getRoleDashboardPath(role: UserRole): string {
  switch (role) {
    case 'employee': return '/employee'
    case 'manager': return '/manager'
    case 'hrbp': return '/hrbp'
    case 'admin': return '/admin'
  }
}
