'use client'

import Link from 'next/link'
import { AlertCircle, CheckCircle2, Clock, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type ActionState = 'action_required' | 'waiting' | 'complete' | 'no_cycle'

interface CycleActionCardProps {
  cycleName: string
  cycleStatus: string
  role: 'employee' | 'manager' | 'hrbp' | 'admin'
  actionState: ActionState
  actionLabel?: string
  actionHref?: string
  waitingFor?: string
  dueDate?: string
}

const BORDER_COLORS: Record<ActionState, string> = {
  action_required: 'border-l-4 border-l-amber-500',
  waiting:         'border-l-4 border-l-blue-500',
  complete:        'border-l-4 border-l-green-500',
  no_cycle:        'border-l-4 border-l-gray-200',
}

const STATE_ICONS: Record<ActionState, React.ReactNode> = {
  action_required: <AlertCircle size={18} className="text-amber-500" />,
  waiting:         <Clock size={18} className="text-blue-500" />,
  complete:        <CheckCircle2 size={18} className="text-green-500" />,
  no_cycle:        <Clock size={18} className="text-gray-400" />,
}

const ROLE_LABELS: Record<CycleActionCardProps['role'], string> = {
  employee: 'Employee',
  manager:  'Manager',
  hrbp:     'HRBP',
  admin:    'Admin',
}

export function CycleActionCard({
  cycleName,
  cycleStatus,
  role,
  actionState,
  actionLabel,
  actionHref,
  waitingFor,
  dueDate,
}: CycleActionCardProps) {
  return (
    <Card className={`${BORDER_COLORS[actionState]} shadow-sm`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {STATE_ICONS[actionState]}
            <CardTitle className="text-base font-semibold">{cycleName}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {ROLE_LABELS[role]}
            </Badge>
            <Badge variant="secondary" className="text-xs capitalize">
              {cycleStatus.replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {actionState === 'action_required' && (
          <div className="flex flex-col gap-3">
            {dueDate && (
              <p className="text-sm text-muted-foreground">
                Due: <span className="font-medium text-foreground">{dueDate}</span>
              </p>
            )}
            {actionHref && actionLabel && (
              <Button asChild size="sm" className="w-fit">
                <Link href={actionHref}>
                  {actionLabel}
                  <ArrowRight size={14} className="ml-1" />
                </Link>
              </Button>
            )}
          </div>
        )}

        {actionState === 'waiting' && (
          <p className="text-sm text-muted-foreground">
            Waiting for:{' '}
            <span className="font-medium text-foreground">{waitingFor ?? '—'}</span>
          </p>
        )}

        {actionState === 'complete' && (
          <p className="text-sm text-green-600 font-medium flex items-center gap-1.5">
            <CheckCircle2 size={14} />
            All done for this cycle phase!
          </p>
        )}

        {actionState === 'no_cycle' && (
          <p className="text-sm text-muted-foreground">No active cycle at this time.</p>
        )}
      </CardContent>
    </Card>
  )
}
