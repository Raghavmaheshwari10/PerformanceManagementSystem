import { Badge } from '@/components/ui/badge'
import { CYCLE_STATUS_LABELS } from '@/lib/constants'
import type { CycleStatus } from '@/lib/types'

interface CycleStageBannerProps {
  cycleName: string
  status: CycleStatus
}

const STATUS_COLORS: Record<CycleStatus, string> = {
  draft:          'bg-muted text-gray-700 hover:bg-muted',
  kpi_setting:    'bg-blue-100 text-blue-800 hover:bg-blue-100',
  self_review:    'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  manager_review: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
  calibrating:    'bg-purple-100 text-purple-800 hover:bg-purple-100',
  locked:         'bg-red-100 text-red-800 hover:bg-red-100',
  published:      'bg-green-100 text-green-800 hover:bg-green-100',
}

export function CycleStageBanner({ cycleName, status }: CycleStageBannerProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-md border bg-muted/40">
      <span className="font-medium text-sm">{cycleName}</span>
      <Badge className={STATUS_COLORS[status]}>
        {CYCLE_STATUS_LABELS[status]}
      </Badge>
    </div>
  )
}
