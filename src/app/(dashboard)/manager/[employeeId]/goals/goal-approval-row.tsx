'use client'

import { useActionState, useEffect, useState } from 'react'
import { approveGoal, rejectGoal } from './actions'
import { SubmitButton } from '@/components/submit-button'
import { useToast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { GOAL_TYPE_LABELS, GOAL_STATUS_LABELS } from '@/lib/constants'
import type { ActionResult, Goal } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  completed: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-muted text-muted-foreground',
}

export function GoalApprovalRow({ goal }: { goal: Goal }) {
  const [approveState, approveAction] = useActionState(approveGoal, INITIAL)
  const [rejectState, rejectAction] = useActionState(rejectGoal, INITIAL)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (approveState !== INITIAL) {
      if (approveState.error) toast.error(approveState.error)
      else toast.success('Goal approved.')
    }
  }, [approveState])

  useEffect(() => {
    if (rejectState !== INITIAL) {
      if (rejectState.error) toast.error(rejectState.error)
      else { toast.success('Goal rejected.'); setShowRejectForm(false) }
    }
  }, [rejectState])

  return (
    <div className="rounded border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{goal.title}</p>
          {goal.description && <p className="text-xs text-muted-foreground">{goal.description}</p>}
          <p className="text-xs text-muted-foreground mt-1">{GOAL_TYPE_LABELS[goal.goal_type] ?? goal.goal_type} · Weight: {goal.weight ?? '—'}%</p>
        </div>
        <span className={cn('text-xs rounded-full px-2 py-0.5 shrink-0', STATUS_COLORS[goal.status] ?? 'bg-muted')}>
          {GOAL_STATUS_LABELS[goal.status] ?? goal.status}
        </span>
      </div>

      {goal.status === 'submitted' && (
        <div className="flex gap-2">
          <form action={approveAction}>
            <input type="hidden" name="goal_id" value={goal.id} />
            <SubmitButton pendingLabel="Approving…">Approve</SubmitButton>
          </form>
          <button
            type="button"
            onClick={() => setShowRejectForm(v => !v)}
            className="rounded border px-3 py-1 text-sm hover:bg-destructive/10 hover:text-destructive"
          >
            Reject
          </button>
        </div>
      )}

      {showRejectForm && (
        <form action={rejectAction} className="space-y-2">
          <input type="hidden" name="goal_id" value={goal.id} />
          <textarea name="manager_comment" rows={2} placeholder="Reason for rejection…" className="w-full rounded border bg-background px-3 py-1.5 text-sm" />
          <div className="flex gap-2">
            <SubmitButton pendingLabel="Rejecting…">Confirm Reject</SubmitButton>
            <button type="button" onClick={() => setShowRejectForm(false)} className="text-sm px-3 py-1 rounded border hover:bg-muted">Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
