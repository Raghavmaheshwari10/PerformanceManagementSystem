'use client'

import { useTransition } from 'react'
import { toggleFeatureFlag } from './actions'

export function FeatureFlagToggle({ flagKey, value }: { flagKey: string; value: boolean }) {
  const [isPending, startTransition] = useTransition()
  
  return (
    <button
      role="switch"
      aria-checked={value}
      disabled={isPending}
      onClick={() => startTransition(() => toggleFeatureFlag(flagKey, !value))}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        value ? 'bg-primary' : 'bg-input',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg',
          'ring-0 transition-transform',
          value ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  )
}
