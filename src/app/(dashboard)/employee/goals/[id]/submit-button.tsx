'use client'

import { useActionState, useEffect } from 'react'
import { submitGoal } from '../actions'
import { SubmitButton } from '@/components/submit-button'
import { useToast } from '@/lib/toast'
import type { ActionResult } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

export function GoalSubmitButton({ goalId }: { goalId: string }) {
  const [state, action] = useActionState(submitGoal, INITIAL)
  const { toast } = useToast()

  useEffect(() => {
    if (state === INITIAL) return
    if (state.error) toast.error(state.error)
    else toast.success('Goal submitted for approval.')
  }, [state])

  return (
    <form action={action}>
      <input type="hidden" name="goal_id" value={goalId} />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Submitting…">Submit for Approval</SubmitButton>
    </form>
  )
}
