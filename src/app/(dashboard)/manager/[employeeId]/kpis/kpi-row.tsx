'use client'

import { useState, useRef, useActionState, useEffect } from 'react'
import { updateKpi, deleteKpi } from '../../actions'
import { SubmitButton } from '@/components/submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/lib/toast'
import type { ActionResult } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

interface KpiRowProps {
  kpiId: string
  employeeId: string
  title: string
  target: number | null
  weight: number | null
  unit: string
  isFinalized: boolean
}

export function KpiRow({ kpiId, employeeId, title, target, weight, unit, isFinalized }: KpiRowProps) {
  const [editing, setEditing] = useState(false)
  const [updateState, updateAction] = useActionState(updateKpi, INITIAL)
  const formRef = useRef<HTMLFormElement>(null)
  const { toast } = useToast()
  const [pendingDelete, setPendingDelete] = useState(false)
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleDelete = () => {
    setPendingDelete(true)
    deleteTimer.current = setTimeout(async () => {
      await deleteKpi(kpiId, employeeId)
    }, 5000)
    toast.success('KPI removed', {
      action: {
        label: 'Undo',
        onClick: () => {
          if (deleteTimer.current) clearTimeout(deleteTimer.current)
          setPendingDelete(false)
        },
      },
      duration: 5000,
    })
  }

  useEffect(() => {
    if (updateState === INITIAL) return
    if (updateState.error) {
      toast.error(updateState.error)
    } else {
      toast.success('KPI updated')
      setEditing(false)
    }
  }, [updateState])

  const formatTarget = () => {
    if (target == null) return null
    if (unit === 'percent') return `${target}%`
    return String(target)
  }

  if (pendingDelete) return null

  if (editing && !isFinalized) {
    return (
      <form ref={formRef} action={updateAction} className="glass-interactive rounded-lg p-3 space-y-2">
        <input type="hidden" name="kpi_id" value={kpiId} />
        <input type="hidden" name="employee_id" value={employeeId} />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div className="sm:col-span-2">
            <Input name="title" defaultValue={title} required placeholder="KPI title" className="text-sm" />
          </div>
          <div>
            <Input name="target" type="number" step="any" defaultValue={target != null ? String(target) : ''} placeholder="Target" className="text-sm" />
          </div>
          <div>
            <Input name="weight" type="number" min="1" max="100" defaultValue={weight != null ? String(weight) : ''} required placeholder="Weight %" className="text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SubmitButton size="sm" pendingLabel="Saving...">Save</SubmitButton>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </form>
    )
  }

  return (
    <div className="glass-interactive flex items-center justify-between rounded-lg p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-medium">{title}</p>
        {target != null && (
          <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
            Target: {formatTarget()}
          </span>
        )}
        {weight != null && (
          <span className="rounded-full bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
            {String(weight)}%
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {!isFinalized && (
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              Remove
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
