'use client'

import { useActionState, useEffect } from 'react'
import { createCompetency } from './actions'
import { SubmitButton } from '@/components/submit-button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/lib/toast'
import type { ActionResult } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

export function CompetencyForm() {
  const [state, action] = useActionState(createCompetency, INITIAL)
  const { toast } = useToast()

  useEffect(() => {
    if (state === INITIAL) return
    if (state.error) toast.error(state.error)
    else toast.success('Competency created.')
  }, [state])

  return (
    <form action={action} className="space-y-3">
      {state.error && <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="name">Name *</Label>
          <input id="name" name="name" required className="w-full rounded border bg-background px-3 py-1.5 text-sm" placeholder="e.g. Leadership" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="description">Description</Label>
          <input id="description" name="description" className="w-full rounded border bg-background px-3 py-1.5 text-sm" placeholder="Optional description" />
        </div>
      </div>
      <SubmitButton pendingLabel="Creating…">Add Competency</SubmitButton>
    </form>
  )
}
