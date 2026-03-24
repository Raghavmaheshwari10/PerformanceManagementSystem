'use client'

import { useActionState, useEffect } from 'react'
import { createGoal } from './actions'
import { SubmitButton } from '@/components/submit-button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/lib/toast'
import type { ActionResult } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

export function GoalForm({ cycleId }: { cycleId: string }) {
  const [state, action] = useActionState(createGoal, INITIAL)
  const { toast } = useToast()

  useEffect(() => {
    if (state === INITIAL) return
    if (state.error) toast.error(state.error)
    else toast.success('Goal created.')
  }, [state])

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="cycle_id" value={cycleId} />

      {state.error && (
        <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="title">Goal Title *</Label>
          <input id="title" name="title" required className="w-full rounded border bg-background px-3 py-1.5 text-sm" placeholder="e.g. Improve customer satisfaction score" />
        </div>

        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <textarea id="description" name="description" rows={2} className="w-full rounded border bg-background px-3 py-1.5 text-sm" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="goal_type">Type</Label>
          <select id="goal_type" name="goal_type" className="w-full rounded border bg-background px-3 py-1.5 text-sm">
            <option value="business">Business</option>
            <option value="development">Development</option>
            <option value="behavior">Behavior</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="weight">Weight (%)</Label>
          <input id="weight" name="weight" type="number" min="0" max="100" step="5" className="w-full rounded border bg-background px-3 py-1.5 text-sm" placeholder="e.g. 30" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="target_value">Target Value</Label>
          <input id="target_value" name="target_value" type="number" step="any" className="w-full rounded border bg-background px-3 py-1.5 text-sm" placeholder="e.g. 90" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="unit">Unit</Label>
          <input id="unit" name="unit" className="w-full rounded border bg-background px-3 py-1.5 text-sm" placeholder="e.g. %, score, count" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="due_date">Due Date</Label>
          <input id="due_date" name="due_date" type="date" className="w-full rounded border bg-background px-3 py-1.5 text-sm" />
        </div>
      </div>

      <SubmitButton pendingLabel="Creating…">Create Goal</SubmitButton>
    </form>
  )
}
