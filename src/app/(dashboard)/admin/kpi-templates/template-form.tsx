'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/submit-button'
import Link from 'next/link'
import type { ActionResult, KpiTemplate } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

interface Props {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  defaultValues?: Partial<KpiTemplate>
}

export function TemplateForm({ action, defaultValues = {} }: Props) {
  const [state, formAction] = useActionState(action, INITIAL)

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="role_slug">Role Slug <span className="text-destructive">*</span></Label>
          <Input id="role_slug" name="role_slug" defaultValue={defaultValues.role_slug} placeholder="e.g. software_engineer" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
          <Input id="title" name="title" defaultValue={defaultValues.title} required />
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
          <Label htmlFor="unit">Unit</Label>
          <select id="unit" name="unit" defaultValue={defaultValues.unit ?? 'percent'}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm">
            <option value="percent">Percent (%)</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="rating">Rating (1-5)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="target">Target</Label>
          <Input id="target" name="target" type="number" step="0.01" defaultValue={defaultValues.target ?? ''} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="weight">Weight (%)</Label>
          <Input id="weight" name="weight" type="number" step="0.01" min="0.01" max="100" defaultValue={defaultValues.weight ?? ''} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input id="is_active" name="is_active" type="checkbox" value="true" defaultChecked={defaultValues.is_active !== false}
          className="rounded" />
        <Label htmlFor="is_active">Active</Label>
      </div>

      <div className="flex gap-3 pt-2">
        <Link href="/admin/kpi-templates"><Button type="button" variant="outline">Cancel</Button></Link>
        <SubmitButton pendingLabel="Saving template…">Save Template</SubmitButton>
      </div>
    </form>
  )
}
