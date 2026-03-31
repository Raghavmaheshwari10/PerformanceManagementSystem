'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateUserRole, toggleUserActive, deleteUser, bulkUpdateDepartment, bulkUpdateRole, bulkToggleActive, bulkDeleteUsers, resendInvite } from './actions'
import type { User } from '@/lib/types'
import { ROLE_LABELS } from '@/lib/constants'

const ROLES = ['employee', 'manager', 'hrbp', 'admin'] as const

export function UsersTable({ users, departments }: { users: User[]; departments: { id: string; name: string }[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const search = searchParams.get('search') ?? ''
  const roleFilter = searchParams.get('role') ?? ''
  const deptFilter = searchParams.get('dept') ?? ''
  const activeFilter = searchParams.get('active') ?? ''

  const [, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<string>('')
  const [bulkValue, setBulkValue] = useState<string>('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)

  const deptNames = [...new Set(users.map(u => u.department?.name).filter(Boolean))].sort() as string[]

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    value ? params.set(key, value) : params.delete(key)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const filtered = users.filter(u => {
    if (search && !u.full_name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false
    if (roleFilter && u.role !== roleFilter) return false
    if (deptFilter && u.department?.name !== deptFilter) return false
    if (activeFilter === 'active' && !u.is_active) return false
    if (activeFilter === 'inactive' && u.is_active) return false
    return true
  })

  const allSelected = filtered.length > 0 && filtered.every(u => selected.has(u.id))

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(u => u.id)))
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  async function handleBulkAction() {
    if (selected.size === 0) return
    const ids = [...selected]
    setBulkLoading(true)
    setBulkError(null)

    let result
    switch (bulkAction) {
      case 'department':
        result = await bulkUpdateDepartment(ids, bulkValue || null)
        break
      case 'role':
        result = await bulkUpdateRole(ids, bulkValue as User['role'])
        break
      case 'activate':
        result = await bulkToggleActive(ids, true)
        break
      case 'deactivate':
        result = await bulkToggleActive(ids, false)
        break
      case 'delete':
        if (!confirm(`Delete ${ids.length} user(s)? This cannot be undone. Users with reviews/appraisals will be skipped.`)) {
          setBulkLoading(false)
          return
        }
        result = await bulkDeleteUsers(ids)
        break
      default:
        setBulkLoading(false)
        return
    }

    setBulkLoading(false)
    if (result?.error) setBulkError(result.error)
    else {
      setSelected(new Set())
      setBulkAction('')
      setBulkValue('')
    }
  }

  async function handleDeleteSingle(userId: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone. If they have reviews/appraisals, deletion will fail.`)) return
    startTransition(async () => {
      const result = await deleteUser(userId)
      if (result.error) alert(result.error)
    })
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search name or email..."
          value={search}
          onChange={e => updateParam('search', e.target.value)}
          className="max-w-xs bg-white/5 border-white/10 text-foreground placeholder:text-foreground/30"
        />
        <select
          value={roleFilter}
          onChange={e => updateParam('role', e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select
          value={deptFilter}
          onChange={e => updateParam('dept', e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All departments</option>
          {deptNames.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={activeFilter}
          onChange={e => updateParam('active', e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <p className="text-xs text-muted-foreground">Showing {filtered.length} of {users.length} users</p>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="glass-strong rounded-xl p-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <select
            value={bulkAction}
            onChange={e => { setBulkAction(e.target.value); setBulkValue(''); setBulkError(null) }}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
          >
            <option value="">Choose action...</option>
            <option value="department">Change Department</option>
            <option value="role">Change Role</option>
            <option value="activate">Activate</option>
            <option value="deactivate">Deactivate</option>
            <option value="delete">Delete</option>
          </select>

          {bulkAction === 'department' && (
            <select
              value={bulkValue}
              onChange={e => setBulkValue(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="">No department</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}

          {bulkAction === 'role' && (
            <select
              value={bulkValue}
              onChange={e => setBulkValue(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="">Select role...</option>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          )}

          <Button
            size="sm"
            disabled={!bulkAction || bulkLoading || (bulkAction === 'role' && !bulkValue)}
            onClick={handleBulkAction}
            variant={bulkAction === 'delete' ? 'destructive' : 'default'}
          >
            {bulkLoading ? 'Processing...' : 'Apply'}
          </Button>

          <button
            onClick={() => { setSelected(new Set()); setBulkAction(''); setBulkError(null) }}
            className="text-xs text-muted-foreground hover:text-foreground ml-auto"
          >
            Clear selection
          </button>

          {bulkError && (
            <p className="w-full text-xs text-amber-400 mt-1">{bulkError}</p>
          )}
        </div>
      )}

      <div className="glass overflow-hidden">
        <table className="w-full text-sm table-row-hover">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="p-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              <th className="p-3 text-left text-muted-foreground">Emp Code</th>
              <th className="p-3 text-left text-muted-foreground">Name</th>
              <th className="p-3 text-left text-muted-foreground">Email</th>
              <th className="p-3 text-left text-muted-foreground">Department</th>
              <th className="p-3 text-left text-muted-foreground">Designation</th>
              <th className="p-3 text-left text-muted-foreground">Role</th>
              <th className="p-3 text-left text-muted-foreground">Status</th>
              <th className="p-3 text-left text-muted-foreground">Invite</th>
              <th className="p-3 text-left text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} className={`border-b border-border ${selected.has(u.id) ? 'bg-primary/5' : ''}`}>
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggleOne(u.id)}
                    className="rounded"
                  />
                </td>
                <td className="p-3 text-xs font-mono text-muted-foreground">{u.emp_code ?? '—'}</td>
                <td className="p-3 font-medium">{u.full_name}</td>
                <td className="p-3 text-muted-foreground">{u.email}</td>
                <td className="p-3 text-muted-foreground">{u.department?.name ?? '—'}</td>
                <td className="p-3 text-muted-foreground">{u.designation ?? '—'}</td>
                <td className="p-3">
                  <select
                    defaultValue={u.role}
                    onChange={e => startTransition(() => updateUserRole(u.id, e.target.value))}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </td>
                <td className="p-3">
                  <button
                    onClick={() => startTransition(() => toggleUserActive(u.id, u.is_active))}
                    className={`text-xs rounded-full px-2 py-0.5 font-medium transition-colors ${
                      u.is_active
                        ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
                        : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                    }`}
                  >
                    {u.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="p-3">
                  {u.password_hash || !u.invite_token ? (
                    <span className="text-xs text-emerald-600">{u.password_hash ? 'Accepted' : 'Google'}</span>
                  ) : u.invite_token ? (
                    u.invite_token_expires_at && new Date(u.invite_token_expires_at) < new Date() ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-red-400">Expired</span>
                        <button
                          onClick={() => startTransition(async () => { await resendInvite(u.id) })}
                          className="text-[10px] text-primary hover:text-primary/80 underline"
                        >
                          Resend
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-amber-400">Pending</span>
                        <button
                          onClick={() => startTransition(async () => { await resendInvite(u.id) })}
                          className="text-[10px] text-primary hover:text-primary/80 underline"
                        >
                          Resend
                        </button>
                      </div>
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/users/${u.id}/edit`} className="text-xs text-primary hover:text-primary/80">
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDeleteSingle(u.id, u.full_name)}
                      className="text-xs text-destructive hover:text-destructive/80"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">No users match your filters</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
