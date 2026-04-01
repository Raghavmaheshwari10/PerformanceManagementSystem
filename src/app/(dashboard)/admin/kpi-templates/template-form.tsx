'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/submit-button'
import Link from 'next/link'
import type { ActionResult, KpiTemplate } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

const ROLE_OPTIONS = [
  { value: 'software_engineer', label: 'Software Engineer' },
  { value: 'senior_engineer', label: 'Senior Engineer' },
  { value: 'engineering_manager', label: 'Engineering Manager' },
  { value: 'product_manager', label: 'Product Manager' },
  { value: 'qa_sdet', label: 'QA / SDET' },
  { value: 'devops_sre', label: 'DevOps / SRE' },
  { value: 'sales_bizdev', label: 'Sales / BizDev' },
  { value: 'hr_people_ops', label: 'HR / People Ops' },
  { value: 'finance', label: 'Finance' },
  { value: 'operations_pm', label: 'Operations / PM' },
]

interface KraTemplateOption {
  id: string
  title: string
  role_slug: string | null
  category: string
}

interface Props {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>
  defaultValues?: Partial<KpiTemplate> & { kra_template_id?: string | null }
  kraTemplates?: KraTemplateOption[]
}

export function TemplateForm({ action, defaultValues = {}, kraTemplates = [] }: Props) {
  const [state, formAction] = useActionState(action, INITIAL)
  const [category, setCategory] = useState<string>(defaultValues.category ?? 'performance')
  const [roleSlug, setRoleSlug] = useState<string>(defaultValues.role_slug ?? '')

  const isPerformance = category === 'performance'

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="role_slug">Role <span className="text-destructive">*</span></Label>
          <select id="role_slug" name="role_slug" value={roleSlug} onChange={e => setRoleSlug(e.target.value)} required
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm">
            <option value="">— Select role —</option>
            {ROLE_OPTIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
          <Input id="title" name="title" defaultValue={defaultValues.title} required />
        </div>
      </div>

      {kraTemplates.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="kra_template_id">KRA Template (parent)</Label>
          <select id="kra_template_id" name="kra_template_id" defaultValue={defaultValues.kra_template_id ?? ''}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm">
            <option value="">— None (unassigned) —</option>
            {kraTemplates
              .filter(k => !roleSlug || !k.role_slug || k.role_slug === roleSlug)
              .map(k => (
                <option key={k.id} value={k.id}>{k.title} ({k.category})</option>
              ))}
          </select>
          <p className="text-[11px] text-muted-foreground">When this template is applied, the KPI will be placed under this KRA.</p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <textarea id="description" name="description" defaultValue={defaultValues.description ?? ''} rows={2}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div className={`grid ${isPerformance ? 'grid-cols-2' : 'grid-cols-1 max-w-xs'} gap-4`}>
        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            name="category"
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
          >
            <option value="performance">Performance</option>
            <option value="behaviour">Behaviour</option>
            <option value="learning">Learning</option>
          </select>
          {!isPerformance && (
            <p className="text-[11px] text-muted-foreground">Subjective category — rated qualitatively, no numeric target needed.</p>
          )}
        </div>
        {isPerformance && (
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
        )}
      </div>

      <div className={`grid ${isPerformance ? 'grid-cols-2' : 'grid-cols-1 max-w-xs'} gap-4`}>
        {isPerformance && (
          <div className="space-y-1.5">
            <Label htmlFor="target">Target</Label>
            <Input id="target" name="target" type="number" step="0.01" defaultValue={defaultValues.target ?? ''} />
          </div>
        )}
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
        <SubmitButton pendingLabel="Saving template...">Save Template</SubmitButton>
      </div>
    </form>
  )
}
