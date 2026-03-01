'use client'

import { useActionState } from 'react'
import { createCycle } from '../../actions'
import { SubmitButton } from '@/components/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionResult } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

export function CycleForm() {
  const [state, action] = useActionState(createCycle, INITIAL)

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Cycle Name</Label>
        <Input id="name" name="name" placeholder="Q1 2026" required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quarter">Quarter</Label>
          <Input id="quarter" name="quarter" placeholder="Q1" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="year">Year</Label>
          <Input id="year" name="year" type="number" defaultValue={2026} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sme_multiplier">SME Payout Multiplier (0-5)</Label>
        <Input id="sme_multiplier" name="sme_multiplier" type="number" step="0.01" placeholder="0.50" required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="business_multiplier">Business Multiplier (0-2.0)</Label>
          <Input id="business_multiplier" name="business_multiplier" type="number" step="0.05" defaultValue={1.0} min={0} max={2} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="budget_currency">Currency</Label>
          <select id="budget_currency" name="budget_currency" defaultValue="INR" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs">
            <option value="INR">INR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="total_budget">Total Budget (optional)</Label>
        <Input id="total_budget" name="total_budget" type="number" step="1000" placeholder="Leave blank if not applicable" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="kpi_setting_deadline">KPI Setting Deadline</Label>
          <Input id="kpi_setting_deadline" name="kpi_setting_deadline" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="self_review_deadline">Self Review Deadline</Label>
          <Input id="self_review_deadline" name="self_review_deadline" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manager_review_deadline">Manager Review Deadline</Label>
          <Input id="manager_review_deadline" name="manager_review_deadline" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="calibration_deadline">Calibration Deadline</Label>
          <Input id="calibration_deadline" name="calibration_deadline" type="date" />
        </div>
      </div>

      <SubmitButton pendingLabel="Creating...">Create Cycle</SubmitButton>
    </form>
  )
}
