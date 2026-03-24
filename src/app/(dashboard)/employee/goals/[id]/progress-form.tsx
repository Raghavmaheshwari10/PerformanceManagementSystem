'use client'

import { useActionState, useEffect } from 'react'
import { updateGoalProgress } from '../actions'
import { SubmitButton } from '@/components/submit-button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/lib/toast'
import type { ActionResult } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

export function GoalProgressForm({ goalId, currentValue }: { goalId: string; currentValue: number }) {
  const [state, action] = useActionState(updateGoalProgress, INITIAL)
  const { toast } = useToast()

  useEffect(() => {
    if (state === INITIAL) return
    if (state.error) toast.error(state.error)
    else toast.success('Progress updated.')
  }, [state])

  return (
    <form action={action} className="rounded border p-4 space-y-3">
      <h2 className="text-sm font-semibold">Update Progress</h2>
      <input type="hidden" name="goal_id" value={goalId} />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="new_value">New Value (current: {currentValue})</Label>
          <input id="new_value" name="new_value" type="number" step="any" required className="w-full rounded border bg-background px-3 py-1.5 text-sm" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="note">Note</Label>
          <input id="note" name="note" className="w-full rounded border bg-background px-3 py-1.5 text-sm" placeholder="Optional" />
        </div>
      </div>
      <SubmitButton pendingLabel="Saving…">Save Progress</SubmitButton>
    </form>
  )
}
