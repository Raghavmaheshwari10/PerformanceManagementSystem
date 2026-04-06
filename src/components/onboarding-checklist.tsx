import Link from 'next/link'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, Rocket, X } from 'lucide-react'

export interface ChecklistItem {
  label: string
  completed: boolean
  href?: string
}

interface OnboardingChecklistProps {
  items: ChecklistItem[]
  dismissAction: () => Promise<void>
}

export function OnboardingChecklist({ items, dismissAction }: OnboardingChecklistProps) {
  const done = items.filter(i => i.completed).length
  const total = items.length
  const pct = Math.round((done / total) * 100)

  if (done === total) return null

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-violet-50/80 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-900">Getting Started</h3>
        </div>
        <form action={dismissAction}>
          <button type="submit" className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Dismiss onboarding checklist">
            <X className="h-4 w-4" />
          </button>
        </form>
      </div>

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-3">
            {item.completed ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-slate-300 shrink-0" />
            )}
            {item.href && !item.completed ? (
              <Link href={item.href} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                {item.label}
              </Link>
            ) : (
              <span className={cn('text-sm', item.completed ? 'text-slate-400 line-through' : 'text-slate-700')}>
                {item.label}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">{done} of {total} completed</span>
          <span className="font-medium text-indigo-600">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-white/80 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}
