'use client'

import { useConfirm } from '@/lib/confirm'
import { useToast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { advanceCycleStatus, advanceDepartmentStatus, revertCycleStatus } from '../../actions'
import { getTransitionLabel } from '@/lib/cycle-machine'
import type { CycleStatus } from '@/lib/types'

interface Props {
  cycleId: string
  departmentId: string | null
  departmentName: string
  currentStatus: CycleStatus
  nextStatus?: CycleStatus | null
  previousStatus?: CycleStatus | null
}

export function DepartmentTransitionClient({
  cycleId,
  departmentId,
  departmentName,
  currentStatus,
  nextStatus,
  previousStatus,
}: Props) {
  const confirm = useConfirm()
  const { toast } = useToast()
  const [loading, setLoading] = useState<string | null>(null)

  const label = nextStatus ? getTransitionLabel(currentStatus, nextStatus) : ''

  async function handleAdvance() {
    if (!nextStatus) return
    const ok = await confirm({
      title: `${label}?`,
      description: departmentId
        ? `This will move "${departmentName}" from ${currentStatus.replace(/_/g, ' ')} to ${nextStatus.replace(/_/g, ' ')}. Other departments are not affected.`
        : `This will move all employees to ${nextStatus.replace(/_/g, ' ')}. This cannot be undone.`,
      confirmLabel: label,
      variant: 'destructive',
    })
    if (!ok) return

    setLoading('advance')
    const result = departmentId
      ? await advanceDepartmentStatus(cycleId, departmentId, currentStatus)
      : await advanceCycleStatus(cycleId, currentStatus)
    setLoading(null)

    if (result.error) toast.error(result.error)
    else toast.success(`${departmentName}: ${label}`)
  }

  async function handleRevert() {
    if (!previousStatus) return
    const ok = await confirm({
      title: 'Revert cycle stage?',
      description: `This will move the cycle back to "${previousStatus.replace(/_/g, ' ')}". All departments at the current stage will also be reverted.`,
      confirmLabel: 'Revert',
      variant: 'destructive',
    })
    if (!ok) return

    setLoading('revert')
    const result = await revertCycleStatus(cycleId, currentStatus)
    setLoading(null)

    if (result.error) toast.error(result.error)
    else toast.success(`Cycle reverted to ${previousStatus.replace(/_/g, ' ')}`)
  }

  return (
    <div className="flex items-center gap-2">
      {previousStatus && !departmentId && (
        <Button
          onClick={handleRevert}
          disabled={!!loading}
          size="sm"
          variant="outline"
        >
          {loading === 'revert' ? 'Reverting...' : `Revert to ${previousStatus.replace(/_/g, ' ')}`}
        </Button>
      )}
      {nextStatus && (
        <Button
          onClick={handleAdvance}
          disabled={!!loading}
          size="sm"
          variant="default"
        >
          {loading === 'advance' ? 'Advancing...' : label}
        </Button>
      )}
    </div>
  )
}
