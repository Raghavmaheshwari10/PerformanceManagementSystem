'use client'

import { useActionState, useEffect } from 'react'
import { addTemplateQuestion } from './actions'
import { SubmitButton } from '@/components/submit-button'
import { Label } from '@/components/ui/label'
import { useToast } from '@/lib/toast'
import type { ActionResult, Competency } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

export function TemplateQuestionForm({ templateId, competencies }: { templateId: string; competencies: Competency[] }) {
  const [state, action] = useActionState(addTemplateQuestion, INITIAL)
  const { toast } = useToast()

  useEffect(() => {
    if (state === INITIAL) return
    if (state.error) toast.error(state.error)
    else toast.success('Question added.')
  }, [state])

  return (
    <form action={action} className="space-y-3 mt-3 border-t pt-3">
      <input type="hidden" name="template_id" value={templateId} />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1 sm:col-span-3">
          <Label htmlFor={`q-${templateId}`}>Question Text *</Label>
          <input id={`q-${templateId}`} name="question_text" required className="w-full rounded border bg-background px-3 py-1.5 text-sm" placeholder="e.g. How effectively does this person communicate?" />
        </div>
        <div className="space-y-1">
          <Label>Answer Type</Label>
          <select name="answer_type" className="w-full rounded border bg-background px-3 py-1.5 text-sm">
            <option value="rating">Rating</option>
            <option value="text">Text</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Competency</Label>
          <select name="competency_id" className="w-full rounded border bg-background px-3 py-1.5 text-sm">
            <option value="">None</option>
            {competencies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <SubmitButton pendingLabel="Adding…">Add Question</SubmitButton>
    </form>
  )
}
