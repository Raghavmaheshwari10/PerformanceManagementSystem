'use client'

import { useConfirm } from '@/lib/confirm'
import { useToast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { advanceCycleStatus, advanceDepartmentStatus } from '../../actions'
import { getTransitionLabel } from '@/lib/cycle-machine'
import type { CycleStatus } from '@/lib/types'

interface Props {
  cycleId: string
  departmentId: string | null
  departmentName: string
  currentStatus: CycleStatus
  nextStatus: CycleStatus
}

export function DepartmentTransitionClient({
  cycleId,
  departmentId,
  departmentName,
  currentStatus,
  nextStatus,
}: Props) {
  const confirm = useConfirm()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const label = getTransitionLabel(currentStatus, nextStatus)

  async function handleAdvance() {
    const ok = await confirm({
      title: `${label}?`,
      description: departmentId
        ? `This will move "${departmentName}" from ${currentStatus.replace(/_/g, ' ')} to ${nextStatus.replace(/_/g, ' ')}. Other departments are not affected.`
        : `This will move all employees to ${nextStatus.replace(/_/g, ' ')}. This cannot be undone.`,
      confirmLabel: label,
      variant: 'destructive',
    })
    if (!ok) return

    setLoading(true)
    const result = departmentId
      ? await advanceDepartmentStatus(cycleId, departmentId, currentStatus)
      : await advanceCycleStatus(cycleId, currentStatus)
    setLoading(false)

    if (result.error) toast.error(result.error)
    else toast.success(`${departmentName}: ${label}`)
  }

  return (
    <Button
      onClick={handleAdvance}
      disabled={loading}
      size="sm"
      variant="default"
    >
      {loading ? 'Advancing...' : label}
    </Button>
  )
}
