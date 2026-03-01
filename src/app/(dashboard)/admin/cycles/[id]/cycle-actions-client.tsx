'use client'

import { useConfirm } from '@/lib/confirm'
import { useToast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { advanceCycleStatus } from '../../actions'
import { sendSelfReviewReminders, sendManagerReviewReminders } from './actions'
import type { CycleStatus } from '@/lib/types'

interface Props {
  cycleId: string
  currentStatus: CycleStatus
  nextStatus: string | null
  pendingSelfCount: number
  pendingManagerCount: number
}

export function CycleActionsClient({
  cycleId,
  currentStatus,
  nextStatus,
  pendingSelfCount,
  pendingManagerCount,
}: Props) {
  const confirm = useConfirm()
  const { toast } = useToast()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleAdvance() {
    const ok = await confirm({
      title: 'Advance cycle?',
      description:
        'This will move the cycle to the next stage and notify the relevant users. This cannot be undone.',
      confirmLabel: 'Advance',
      variant: 'destructive',
    })
    if (!ok) return
    setLoading('advance')
    const result = await advanceCycleStatus(cycleId, currentStatus)
    setLoading(null)
    if (result.error) toast.error(result.error)
    else toast.success('Cycle advanced successfully.')
  }

  async function handleSelfReminders() {
    const ok = await confirm({
      title: 'Send self-review reminders?',
      description: `This will send a reminder to ${pendingSelfCount} employee${pendingSelfCount !== 1 ? 's' : ''} who haven't submitted yet.`,
      confirmLabel: 'Send reminders',
    })
    if (!ok) return
    setLoading('self')
    const result = await sendSelfReviewReminders(cycleId)
    setLoading(null)
    if (result.error) toast.error(result.error)
    else
      toast.success(
        `Reminders sent to ${pendingSelfCount} employee${pendingSelfCount !== 1 ? 's' : ''}.`,
      )
  }

  async function handleManagerReminders() {
    const ok = await confirm({
      title: 'Send manager review reminders?',
      description: `This will send a reminder to ${pendingManagerCount} manager${pendingManagerCount !== 1 ? 's' : ''} who have outstanding reviews.`,
      confirmLabel: 'Send reminders',
    })
    if (!ok) return
    setLoading('mgr')
    const result = await sendManagerReviewReminders(cycleId)
    setLoading(null)
    if (result.error) toast.error(result.error)
    else
      toast.success(
        `Reminders sent to ${pendingManagerCount} manager${pendingManagerCount !== 1 ? 's' : ''}.`,
      )
  }

  return (
    <div className="flex flex-wrap gap-3">
      {nextStatus && (
        <Button onClick={handleAdvance} disabled={!!loading} variant="destructive" data-tour="advance-btn">
          {loading === 'advance' ? 'Advancing…' : `Advance to ${nextStatus.replace(/_/g, ' ')}`}
        </Button>
      )}
      {pendingSelfCount > 0 && (
        <Button variant="outline" onClick={handleSelfReminders} disabled={!!loading}>
          {loading === 'self'
            ? 'Sending…'
            : `Remind ${pendingSelfCount} pending self-review${pendingSelfCount !== 1 ? 's' : ''}`}
        </Button>
      )}
      {pendingManagerCount > 0 && (
        <Button variant="outline" onClick={handleManagerReminders} disabled={!!loading}>
          {loading === 'mgr'
            ? 'Sending…'
            : `Remind ${pendingManagerCount} pending manager review${pendingManagerCount !== 1 ? 's' : ''}`}
        </Button>
      )}
    </div>
  )
}
