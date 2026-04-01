'use client'

import { useActionState } from 'react'
import { upsertActual } from './actions'
import { ChevronDown, Save } from 'lucide-react'

interface ActualsFormProps {
  targetId: string
  targetName: string
  year: number
  existingActuals: Record<number, number> // month -> actual_value
}

const MONTHS = [
  'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
  'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar',
]
// Indian FY month mapping: Apr=4, May=5, ..., Mar=3
const MONTH_NUMBERS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]

export function ActualsForm({ targetId, targetName, year, existingActuals }: ActualsFormProps) {
  const [state, formAction, pending] = useActionState(upsertActual, { data: null, error: null })

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">
        Enter monthly actuals for <span className="text-foreground font-semibold">{targetName}</span> — FY {year}
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {MONTHS.map((label, i) => {
          const monthNum = MONTH_NUMBERS[i]
          const existing = existingActuals[monthNum]
          return (
            <form key={monthNum} action={formAction} className="space-y-1">
              <input type="hidden" name="aop_target_id" value={targetId} />
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="month" value={monthNum} />
              <label className="text-[10px] font-semibold text-muted-foreground uppercase">{label}</label>
              <div className="flex gap-1">
                <input
                  name="actual_value"
                  type="number"
                  step="0.01"
                  defaultValue={existing ?? ''}
                  placeholder="—"
                  className="w-full rounded border border-border bg-muted/30 px-2 py-1.5 text-xs tabular-nums focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="shrink-0 rounded border border-border bg-muted/30 px-1.5 py-1.5 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors disabled:opacity-50"
                  title={`Save ${label}`}
                >
                  <Save className="h-3 w-3" />
                </button>
              </div>
            </form>
          )
        })}
      </div>

      {state.error && (
        <p className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1">{state.error}</p>
      )}
    </div>
  )
}
