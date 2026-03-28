'use client'

import { useTransition } from 'react'
import { triggerSync } from './actions'

export function SyncButton() {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      className="glass-glow rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
      disabled={isPending}
      onClick={() => startTransition(async () => { await triggerSync() })}
    >
      {isPending ? 'Syncing...' : 'Sync Now'}
    </button>
  )
}
