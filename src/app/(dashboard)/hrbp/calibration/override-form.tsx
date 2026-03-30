'use client'

import { useActionState, useEffect, useRef } from 'react'
import { overrideRating } from '../actions'
import { SubmitButton } from '@/components/submit-button'
import { Input } from '@/components/ui/input'
import { RATING_TIERS } from '@/lib/constants'
import { useToast } from '@/lib/toast'
import type { ActionResult } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

interface OverrideFormProps {
  appraisalId: string
  cycleId: string
  currentRating: string | null
}

export function OverrideForm({ appraisalId, cycleId, currentRating }: OverrideFormProps) {
  const [state, action] = useActionState(overrideRating, INITIAL)
  const { toast } = useToast()
  const submitCount = useRef(0)

  useEffect(() => {
    // Skip the initial render before any submission
    if (submitCount.current === 0) return
    if (state.error) {
      toast.error(state.error)
    } else {
      toast.success('Rating override saved.')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <div className="space-y-1">
      <form action={action} className="flex gap-2" onSubmit={() => { submitCount.current++ }}>
        <input type="hidden" name="appraisal_id" value={appraisalId} />
        <input type="hidden" name="cycle_id" value={cycleId} />
        <select
          name="final_rating"
          className="rounded border bg-background px-2 py-1 text-sm"
          defaultValue={currentRating ?? ''}
        >
          {RATING_TIERS.map(t => <option key={t.code} value={t.code}>{t.code}</option>)}
        </select>
        <Input name="justification" placeholder="Justification" className="text-sm" required />
        <SubmitButton size="sm" pendingLabel="Saving override…">Save</SubmitButton>
      </form>
      {state.error && (
        <p className="text-xs text-destructive">{state.error}</p>
      )}
    </div>
  )
}
