'use client'

import { useToast } from '@/lib/toast'
import { cn } from '@/lib/utils'

const ICONS: Record<string, string> = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warning: '⚠',
}

const COLOURS: Record<string, string> = {
  success: 'border-green-500 bg-green-50 text-green-900',
  error:   'border-red-500 bg-red-50 text-red-900',
  info:    'border-blue-500 bg-blue-50 text-blue-900',
  warning: 'border-yellow-500 bg-yellow-50 text-yellow-900',
}

export function Toaster() {
  const { toasts, dismiss } = useToast()
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 w-80">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            'flex items-start gap-3 rounded-lg border px-4 py-3 shadow-md text-sm',
            'animate-in slide-in-from-bottom-2 duration-200',
            COLOURS[t.variant]
          )}
        >
          <span className="font-bold text-base leading-none mt-0.5">{ICONS[t.variant]}</span>
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              onClick={() => { t.action!.onClick(); dismiss(t.id) }}
              className="shrink-0 rounded-md border border-current/20 px-2 py-0.5 text-xs font-semibold hover:bg-black/5 transition-colors"
            >
              {t.action.label}
            </button>
          )}
          <button onClick={() => dismiss(t.id)} className="opacity-50 hover:opacity-100 text-xs ml-1 shrink-0">✕</button>
        </div>
      ))}
    </div>
  )
}
