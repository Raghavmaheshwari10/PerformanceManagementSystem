'use client'

import { useActionState, useEffect, useState } from 'react'
import { createCompetency } from './actions'
import { SubmitButton } from '@/components/submit-button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/lib/toast'
import type { ActionResult } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

interface Props {
  departments?: { id: string; name: string }[]
  roleOptions?: { value: string; label: string }[]
}

export function CompetencyForm({ departments = [], roleOptions = [] }: Props) {
  const [state, action] = useActionState(createCompetency, INITIAL)
  const { toast } = useToast()
  const [category, setCategory] = useState('core')
  const [profLevels, setProfLevels] = useState<{ band: string; label: string; description: string }[]>([])

  useEffect(() => {
    if (state === INITIAL) return
    if (state.error) toast.error(state.error)
    else toast.success('Competency created.')
  }, [state])

  function addProfLevel() {
    setProfLevels([...profLevels, { band: '', label: '', description: '' }])
  }

  function removeProfLevel(idx: number) {
    setProfLevels(profLevels.filter((_, i) => i !== idx))
  }

  return (
    <form action={action} className="space-y-4">
      {state.error && <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="name">Name *</Label>
          <input id="name" name="name" required className="w-full rounded border bg-background px-3 py-1.5 text-sm" placeholder="e.g. Leadership" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="category">Category</Label>
          <select id="category" name="category" value={category} onChange={e => setCategory(e.target.value)}
            className="w-full rounded border bg-background px-3 py-1.5 text-sm">
            <option value="core">Core (Org-wide)</option>
            <option value="functional">Functional (Department-specific)</option>
            <option value="leadership">Leadership (Role/Band-specific)</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <textarea id="description" name="description" rows={2}
          className="w-full rounded border bg-background px-3 py-1.5 text-sm" placeholder="What this competency measures..." />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {category === 'functional' && (
          <div className="space-y-1">
            <Label htmlFor="department_id">Department</Label>
            <select id="department_id" name="department_id"
              className="w-full rounded border bg-background px-3 py-1.5 text-sm">
              <option value="">— All departments —</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}
        {category === 'leadership' && (
          <div className="space-y-1">
            <Label htmlFor="role_slug_id">Role</Label>
            <select id="role_slug_id" name="role_slug_id"
              className="w-full rounded border bg-background px-3 py-1.5 text-sm">
              <option value="">— All roles —</option>
              {roleOptions.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Proficiency Levels */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Proficiency Levels</Label>
          <button type="button" onClick={addProfLevel} className="text-xs text-primary hover:underline">
            + Add Level
          </button>
        </div>
        {profLevels.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No proficiency levels defined. Click &quot;+ Add Level&quot; to define band-specific expectations.</p>
        )}
        {profLevels.map((p, i) => (
          <div key={i} className="grid grid-cols-[100px_1fr_2fr_auto] gap-2 items-start">
            <input name="prof_band" value={p.band} onChange={e => {
              const updated = [...profLevels]
              updated[i] = { ...updated[i], band: e.target.value }
              setProfLevels(updated)
            }} placeholder="Band (L1-L3)" className="rounded border bg-background px-2 py-1 text-xs" />
            <input name="prof_label" value={p.label} onChange={e => {
              const updated = [...profLevels]
              updated[i] = { ...updated[i], label: e.target.value }
              setProfLevels(updated)
            }} placeholder="Label (Beginner)" className="rounded border bg-background px-2 py-1 text-xs" />
            <input name="prof_description" value={p.description} onChange={e => {
              const updated = [...profLevels]
              updated[i] = { ...updated[i], description: e.target.value }
              setProfLevels(updated)
            }} placeholder="Demonstrates basic understanding..." className="rounded border bg-background px-2 py-1 text-xs" />
            <button type="button" onClick={() => removeProfLevel(i)} className="text-xs text-destructive hover:underline pt-1">
              Remove
            </button>
          </div>
        ))}
      </div>

      <SubmitButton pendingLabel="Creating...">Add Competency</SubmitButton>
    </form>
  )
}
