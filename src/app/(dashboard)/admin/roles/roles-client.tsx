'use client'

import { useState, useTransition } from 'react'
import { useActionState } from 'react'
import { createRoleSlug, updateRoleSlug, toggleRoleSlug, deleteRoleSlug } from './actions'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import type { ActionResult } from '@/lib/types'

interface RoleSlugRow {
  id: string
  slug: string
  label: string
  sort_order: number
  is_active: boolean
  kpi_count: number
  kra_count: number
}

const INITIAL: ActionResult = { data: null, error: null }

export function RolesClient({ roles }: { roles: RoleSlugRow[] }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <div className="space-y-4">
      {/* Add button */}
      {!showAdd && (
        <button
          onClick={() => { setShowAdd(true); setEditingId(null) }}
          className="glow-button flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" />
          Add Role
        </button>
      )}

      {/* Add form */}
      {showAdd && <AddRoleForm onClose={() => setShowAdd(false)} />}

      {/* Roles table */}
      {roles.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center py-10 text-center">
          <p className="text-sm font-medium mb-1">No roles defined yet</p>
          <p className="text-xs text-muted-foreground">Add roles to use in KPI and KRA templates.</p>
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="p-3 text-left text-muted-foreground">Label</th>
                <th className="p-3 text-left text-muted-foreground">Slug</th>
                <th className="p-3 text-center text-muted-foreground">Order</th>
                <th className="p-3 text-center text-muted-foreground">KPI Templates</th>
                <th className="p-3 text-center text-muted-foreground">KRA Templates</th>
                <th className="p-3 text-center text-muted-foreground">Status</th>
                <th className="p-3 text-right text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(role => (
                editingId === role.id ? (
                  <EditRoleRow key={role.id} role={role} onClose={() => setEditingId(null)} />
                ) : (
                  <tr key={role.id} className="border-b border-border hover:bg-muted/10">
                    <td className="p-3 font-medium">{role.label}</td>
                    <td className="p-3">
                      <code className="rounded bg-muted/50 px-1.5 py-0.5 text-xs">{role.slug}</code>
                    </td>
                    <td className="p-3 text-center tabular-nums text-muted-foreground">{role.sort_order}</td>
                    <td className="p-3 text-center tabular-nums">{role.kpi_count}</td>
                    <td className="p-3 text-center tabular-nums">{role.kra_count}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => startTransition(async () => { await toggleRoleSlug(role.id) })}
                        disabled={isPending}
                        className={`text-xs rounded-full px-2 py-0.5 font-medium transition-colors ${
                          role.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}>
                        {role.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditingId(role.id); setShowAdd(false) }}
                          className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (!confirm(`Delete role "${role.label}"? This only works if no templates use it.`)) return
                            startTransition(async () => { await deleteRoleSlug(role.id) })
                          }}
                          disabled={isPending}
                          className="rounded p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AddRoleForm({ onClose }: { onClose: () => void }) {
  const [state, formAction, pending] = useActionState(createRoleSlug, INITIAL)
  const [label, setLabel] = useState('')

  const autoSlug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')

  return (
    <div className="glass rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Add New Role</h3>
        <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50">
          <X className="h-4 w-4" />
        </button>
      </div>
      <form action={async (fd) => { await formAction(fd); if (!state.error) onClose() }} className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Label *</label>
            <input
              name="label"
              value={label}
              onChange={e => setLabel(e.target.value)}
              required
              placeholder="e.g., Data Analyst"
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Slug (auto-generated)</label>
            <input
              name="slug"
              defaultValue=""
              placeholder={autoSlug || 'data_analyst'}
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-mono focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
            <p className="text-[10px] text-muted-foreground">Leave empty to auto-generate from label</p>
          </div>
        </div>
        {state.error && (
          <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{state.error}</p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="glow-button flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {pending ? 'Creating...' : 'Create Role'}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

function EditRoleRow({ role, onClose }: { role: RoleSlugRow; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(updateRoleSlug, INITIAL)

  return (
    <tr className="border-b border-border bg-primary/5">
      <td colSpan={7} className="p-3">
        <form action={async (fd) => { await formAction(fd); if (!state.error) onClose() }} className="flex items-end gap-3 flex-wrap">
          <input type="hidden" name="id" value={role.id} />
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Label</label>
            <input
              name="label"
              defaultValue={role.label}
              required
              className="rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Slug</label>
            <input
              name="slug"
              defaultValue={role.slug}
              className="rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-sm font-mono focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Order</label>
            <input
              name="sort_order"
              type="number"
              defaultValue={role.sort_order}
              className="w-20 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-sm tabular-nums focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-primary/20 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/30 transition-colors disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
          {state.error && (
            <p className="text-xs text-red-400">{state.error}</p>
          )}
        </form>
      </td>
    </tr>
  )
}
