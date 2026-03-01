'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { updateUserRole, toggleUserActive } from './actions'
import type { User } from '@/lib/types'

const ROLES = ['employee', 'manager', 'hrbp', 'admin'] as const

export function UsersTable({ users }: { users: User[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const search = searchParams.get('search') ?? ''
  const roleFilter = searchParams.get('role') ?? ''
  const deptFilter = searchParams.get('dept') ?? ''
  const activeFilter = searchParams.get('active') ?? ''

  const [, startTransition] = useTransition()

  const departments = [...new Set(users.map(u => u.department).filter(Boolean))].sort() as string[]

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    value ? params.set(key, value) : params.delete(key)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const filtered = users.filter(u => {
    if (search && !u.full_name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false
    if (roleFilter && u.role !== roleFilter) return false
    if (deptFilter && u.department !== deptFilter) return false
    if (activeFilter === 'active' && !u.is_active) return false
    if (activeFilter === 'inactive' && u.is_active) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search name or email…"
          value={search}
          onChange={e => updateParam('search', e.target.value)}
          className="max-w-xs"
        />
        <select
          value={roleFilter}
          onChange={e => updateParam('role', e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={deptFilter}
          onChange={e => updateParam('dept', e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={activeFilter}
          onChange={e => updateParam('active', e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <p className="text-xs text-muted-foreground">Showing {filtered.length} of {users.length} users</p>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Department</th>
              <th className="p-3 text-left">Designation</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} className="border-t">
                <td className="p-3 font-medium">{u.full_name}</td>
                <td className="p-3 text-muted-foreground">{u.email}</td>
                <td className="p-3 text-muted-foreground">{u.department ?? '—'}</td>
                <td className="p-3 text-muted-foreground">{u.designation ?? '—'}</td>
                <td className="p-3">
                  <select
                    defaultValue={u.role}
                    onChange={e => startTransition(() => updateUserRole(u.id, e.target.value))}
                    className="rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="p-3">
                  <button
                    onClick={() => startTransition(() => toggleUserActive(u.id, u.is_active))}
                    className={`text-xs rounded-full px-2 py-0.5 font-medium transition-colors ${
                      u.is_active
                        ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    }`}
                  >
                    {u.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No users match your filters</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
