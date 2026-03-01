import { cn } from '@/lib/utils'
import type { CycleStatus } from '@/lib/types'

const STAGES: { key: CycleStatus; label: string }[] = [
  { key: 'kpi_setting',    label: 'KPI Setting'     },
  { key: 'self_review',    label: 'Self Review'      },
  { key: 'manager_review', label: 'Manager Review'   },
  { key: 'calibrating',    label: 'Calibration'      },
  { key: 'locked',         label: 'Locked'           },
  { key: 'published',      label: 'Published'        },
]

const STATUS_ORDER: CycleStatus[] = [
  'draft', 'kpi_setting', 'self_review', 'manager_review', 'calibrating', 'locked', 'published',
]

export function CycleTimeline({ currentStatus }: { currentStatus: CycleStatus }) {
  const currentIdx = STATUS_ORDER.indexOf(currentStatus)

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Cycle Progress</h3>
      <ol className="space-y-2">
        {STAGES.map(stage => {
          const stageIdx = STATUS_ORDER.indexOf(stage.key)
          const isPast    = stageIdx < currentIdx
          const isCurrent = stage.key === currentStatus
          const isFuture  = stageIdx > currentIdx

          return (
            <li key={stage.key} className="flex items-center gap-2.5">
              {/* Indicator dot */}
              <span className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                isPast    && 'bg-muted text-muted-foreground',
                isCurrent && 'bg-primary text-primary-foreground ring-2 ring-primary/30',
                isFuture  && 'border border-border text-muted-foreground',
              )}>
                {isPast ? '✓' : isCurrent ? '●' : '○'}
              </span>
              <span className={cn(
                'text-sm',
                isPast    && 'text-muted-foreground line-through',
                isCurrent && 'font-semibold text-foreground',
                isFuture  && 'text-muted-foreground',
              )}>
                {stage.label}
              </span>
              {isCurrent && (
                <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Now
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
