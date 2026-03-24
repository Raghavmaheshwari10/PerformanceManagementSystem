'use client'

import { useActionState, useEffect } from 'react'
import { createReviewTemplate } from './actions'
import { SubmitButton } from '@/components/submit-button'
import { useToast } from '@/lib/toast'
import type { ActionResult } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

export function CreateTemplateForm() {
  const [state, action] = useActionState(createReviewTemplate, INITIAL)
  const { toast } = useToast()

  useEffect(() => {
    if (state === INITIAL) return
    if (state.error) toast.error(state.error)
    else toast.success('Template created.')
  }, [state])

  return (
    <form action={action} className="flex gap-3">
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <input name="name" required placeholder="Template name…" className="flex-1 rounded border bg-background px-3 py-1.5 text-sm" />
      <input name="description" placeholder="Description (optional)" className="flex-1 rounded border bg-background px-3 py-1.5 text-sm" />
      <SubmitButton pendingLabel="Creating…">Create</SubmitButton>
    </form>
  )
}
