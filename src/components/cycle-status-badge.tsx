import { Badge } from '@/components/ui/badge'
import { CYCLE_STATUS_LABELS } from '@/lib/constants'
import type { CycleStatus } from '@/lib/types'

const STATUS_COLORS: Record<CycleStatus, { className: string; textShadow: string }> = {
  draft:          { className: 'bg-white/10 text-white/60',          textShadow: '0 0 8px rgba(255,255,255,0.15)' },
  kpi_setting:    { className: 'bg-blue-500/15 text-blue-400',      textShadow: '0 0 8px rgba(96,165,250,0.4)' },
  self_review:    { className: 'bg-yellow-500/15 text-yellow-400',   textShadow: '0 0 8px rgba(250,204,21,0.4)' },
  manager_review: { className: 'bg-orange-500/15 text-orange-400',   textShadow: '0 0 8px rgba(251,146,60,0.4)' },
  calibrating:    { className: 'bg-purple-500/15 text-purple-400',   textShadow: '0 0 8px rgba(192,132,252,0.4)' },
  locked:         { className: 'bg-red-500/15 text-red-400',         textShadow: '0 0 8px rgba(248,113,113,0.4)' },
  published:      { className: 'bg-green-500/15 text-green-400',     textShadow: '0 0 8px rgba(74,222,128,0.4)' },
}

export function CycleStatusBadge({ status }: { status: CycleStatus }) {
  const colors = STATUS_COLORS[status]
  return (
    <Badge className={colors.className} variant="outline" style={{ textShadow: colors.textShadow }}>
      {CYCLE_STATUS_LABELS[status]}
    </Badge>
  )
}
