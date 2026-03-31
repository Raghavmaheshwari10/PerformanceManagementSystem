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
      <ol className="relative space-y-0">
        {STAGES.map((stage, i) => {
          const stageIdx = STATUS_ORDER.indexOf(stage.key)
          const isPast    = stageIdx < currentIdx
          const isCurrent = stage.key === currentStatus
          const isFuture  = stageIdx > currentIdx
          const isLast    = i === STAGES.length - 1

          return (
            <li key={stage.key} className="relative flex items-start gap-2.5 pb-4 last:pb-0">
              {/* Connecting line */}
              {!isLast && (
                <div
                  className={cn(
                    'absolute left-[9px] top-5 h-[calc(100%-12px)] w-px',
                    isPast ? 'bg-muted/50' : isCurrent ? 'bg-primary/20' : 'bg-muted/30'
                  )}
                />
              )}
              {/* Indicator dot */}
              <span
                className={cn(
                  'relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                  isPast    && 'bg-muted/50 text-muted-foreground/60',
                  isCurrent && 'bg-primary text-primary-foreground ring-2 ring-primary/30',
                  isFuture  && 'border border-border text-muted-foreground/40',
                )}
                style={isCurrent ? { animation: 'pulseGlow 2s ease-in-out infinite' } : undefined}
              >
                {isPast ? '✓' : isCurrent ? '●' : '○'}
              </span>
              <span className={cn(
                'text-sm pt-0.5',
                isPast    && 'text-muted-foreground/60 line-through',
                isCurrent && 'font-semibold text-foreground',
                isFuture  && 'text-muted-foreground/40',
              )}>
                {stage.label}
              </span>
              {isCurrent && (
                <span className="ml-auto rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
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
