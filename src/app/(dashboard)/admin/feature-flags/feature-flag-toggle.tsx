'use client'

import { useTransition } from 'react'
import { useConfirm } from '@/lib/confirm'
import { useToast } from '@/lib/toast'
import { toggleFeatureFlag } from './actions'

interface FeatureFlagToggleProps {
  flagKey: string
  value: boolean
  name: string
  category: 'module' | 'ui' | 'notify'
}

export function FeatureFlagToggle({ flagKey, value, name, category }: FeatureFlagToggleProps) {
  const [isPending, startTransition] = useTransition()
  const confirm = useConfirm()
  const { toast } = useToast()

  async function handleToggle() {
    if (category === 'module') {
      const ok = await confirm({
        title: `${value ? 'Disable' : 'Enable'} ${name}?`,
        description: `This affects all users immediately. ${value ? 'Disabling' : 'Enabling'} a module changes what everyone can see.`,
        confirmLabel: value ? 'Disable' : 'Enable',
        variant: 'destructive',
      })
      if (!ok) return
    }

    startTransition(async () => {
      const result = await toggleFeatureFlag(flagKey, !value)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${name} ${!value ? 'enabled' : 'disabled'}.`)
      }
    })
  }

  return (
    <button
      role="switch"
      aria-checked={value}
      disabled={isPending}
      onClick={handleToggle}
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
