'use client'

import { useConfirm } from '@/lib/confirm'
import { useToast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { lockCycle, publishCycle } from '../actions'

interface Props {
  cycleId: string
  canLock: boolean
  canPublish: boolean
  isLocked: boolean
}

export function CalibrationActionsClient({ cycleId, canLock, canPublish, isLocked }: Props) {
  const confirm = useConfirm()
  const { toast } = useToast()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleLock() {
    const ok = await confirm({
      title: 'Lock cycle?',
      description: 'Locking freezes all ratings — no more overrides will be possible after this.',
      confirmLabel: 'Lock',
      variant: 'destructive',
    })
    if (!ok) return
    setLoading('lock')
    const result = await lockCycle(cycleId)
    setLoading(null)
    if (result.error) toast.error(result.error)
    else toast.success('Cycle locked. Ratings are now final.')
  }

  async function handlePublish() {
    const ok = await confirm({
      title: 'Publish results?',
      description: 'Publishing makes results visible to all employees. This cannot be undone.',
      confirmLabel: 'Publish',
      variant: 'destructive',
    })
    if (!ok) return
    setLoading('publish')
    const result = await publishCycle(cycleId)
    setLoading(null)
    if (result.error) toast.error(result.error)
    else toast.success('Results published. Employees can now see their ratings.')
  }

  return (
    <div className="flex gap-3" data-tour="lock-publish-actions">
      {canLock && !isLocked && (
        <Button
          variant="outline"
          onClick={handleLock}
          disabled={!!loading}
          data-tour="lock-btn"
        >
          {loading === 'lock' ? 'Locking…' : 'Lock Cycle'}
        </Button>
      )}
      {canPublish && isLocked && (
        <Button
          onClick={handlePublish}
          disabled={!!loading}
          data-tour="publish-btn"
        >
          {loading === 'publish' ? 'Publishing…' : 'Publish Results'}
        </Button>
      )}
    </div>
  )
}
