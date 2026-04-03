'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { deleteCycle } from '../actions'

export function DeleteCycleButton({ cycleId, cycleName }: { cycleId: string; cycleName: string }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteCycle(cycleId)
      if (result.error) {
        setError(result.error)
      } else {
        setShowConfirm(false)
      }
    })
  }

  if (!showConfirm) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={() => setShowConfirm(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowConfirm(false)}>
      <div
        className="glass mx-4 w-full max-w-md space-y-4 rounded-xl border border-border p-6"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-destructive">Delete Cycle</h3>
        <p className="text-sm text-muted-foreground">
          This will permanently delete <strong>{cycleName}</strong> and all its related data including KPIs, reviews, appraisals, meetings, and goals. This action cannot be undone.
        </p>
        <div>
          <label className="text-sm font-medium">
            Type <strong>{cycleName}</strong> to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive/50"
            placeholder={cycleName}
            autoFocus
          />
        </div>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" size="sm" onClick={() => { setShowConfirm(false); setConfirmText(''); setError(null) }}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={confirmText !== cycleName || isPending}
            onClick={handleDelete}
          >
            {isPending ? 'Deleting...' : 'Delete Cycle'}
          </Button>
        </div>
      </div>
    </div>
  )
}
