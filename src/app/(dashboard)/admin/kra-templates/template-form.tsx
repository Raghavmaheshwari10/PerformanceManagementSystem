'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/submit-button'
import Link from 'next/link'
import type { ActionResult, KraTemplate } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

interface RoleOption {
  value: string
  label: string
}

interface Props {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  defaultValues?: Partial<KraTemplate>
  departments: { id: string; name: string }[]
  roleOptions?: RoleOption[]
}

export function KraTemplateForm({ action, defaultValues = {}, departments, roleOptions = [] }: Props) {
  const [state, formAction] = useActionState(action, INITIAL)

  return (
    <form action={formAction} className="glass rounded-lg border p-6 space-y-5">
      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
          <Input id="title" name="title" defaultValue={defaultValues.title} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role_slug_id">Role</Label>
          <select id="role_slug_id" name="role_slug_id" defaultValue={defaultValues.role_slug_id ?? ''}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm">
            <option value="">— No role —</option>
            {roleOptions.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <textarea id="description" name="description" defaultValue={defaultValues.description ?? ''} rows={2}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <select id="category" name="category" defaultValue={defaultValues.category ?? 'performance'}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm">
            <option value="performance">Performance</option>
            <option value="behaviour">Behaviour</option>
            <option value="learning">Learning</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="department_id">Department</Label>
          <select id="department_id" name="department_id" defaultValue={defaultValues.department_id ?? ''}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm">
            <option value="">— None —</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="weight">Weight (%)</Label>
          <Input id="weight" name="weight" type="number" step="0.01" min="0" max="100" defaultValue={defaultValues.weight ?? ''} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input id="is_active" name="is_active" type="checkbox" value="true" defaultChecked={defaultValues.is_active !== false}
          className="rounded" />
        <Label htmlFor="is_active">Active</Label>
      </div>

      <div className="flex gap-3 pt-2">
        <Link href="/admin/kra-templates"><Button type="button" variant="outline">Cancel</Button></Link>
        <SubmitButton pendingLabel="Saving template...">Save Template</SubmitButton>
      </div>
    </form>
  )
}
