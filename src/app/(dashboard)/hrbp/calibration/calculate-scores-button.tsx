'use client'

import { useTransition } from 'react'
import { calculateCycleScores } from './score-actions'
import { useToast } from '@/lib/toast'

export function CalculateScoresButton({ cycleId }: { cycleId: string }) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function handleClick() {
    startTransition(async () => {
      const result = await calculateCycleScores(cycleId)
      if (result.error) toast.error(result.error)
      else toast.success(`Scores calculated for ${result.count} employees.`)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="rounded border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
    >
      {isPending ? 'Calculating…' : 'Calculate Scores'}
    </button>
  )
}
