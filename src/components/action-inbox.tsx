import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Cycle, CycleStatus, Kpi, Review } from '@/lib/types'

interface ActionInboxProps {
  cycle: Cycle
  resolvedStatus: CycleStatus
  kpis: Kpi[]
  review: Review | null
}

type UrgencyLevel = 'critical' | 'warning' | 'info' | 'success'

interface Action {
  label: string
  description: string
  href?: string
  urgency: UrgencyLevel
  primary?: boolean
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function computeActions(cycle: Cycle, resolvedStatus: CycleStatus, kpis: Kpi[], review: Review | null): Action[] {
  const actions: Action[] = []

  if (resolvedStatus === 'kpi_setting') {
    const days = daysUntil(cycle.kpi_setting_deadline)
    const urgency: UrgencyLevel =
      days === null ? 'info' :
      days < 0 ? 'critical' :
      days <= 2 ? 'critical' :
      days <= 5 ? 'warning' : 'info'

    if (kpis.length === 0) {
      actions.push({
        label: 'No KPIs assigned yet',
        description: 'Your manager hasn\'t set up KPIs for this cycle. Check back soon.',
        urgency: 'info',
        primary: true,
      })
    } else {
      actions.push({
        label: 'Review your KPIs',
        description: days !== null
          ? days < 0 ? `KPI setting deadline was ${Math.abs(days)} day(s) ago`
          : days === 0 ? 'KPI setting deadline is today'
          : `KPI setting deadline in ${days} day(s)`
          : 'KPI setting is open',
        urgency,
        primary: true,
      })
    }
  }

  if (resolvedStatus === 'self_review') {
    const days = daysUntil(cycle.self_review_deadline)
    const urgency: UrgencyLevel =
      days === null ? 'info' :
      days < 0 ? 'critical' :
      days <= 2 ? 'critical' :
      days <= 5 ? 'warning' : 'info'

    if (!review || review.status === 'draft') {
      actions.push({
        label: 'Complete your self-review',
        description: days !== null
          ? days < 0 ? `Deadline was ${Math.abs(days)} day(s) ago — submit now`
          : days === 0 ? 'Due today — don\'t miss it'
          : `Due in ${days} day(s)`
          : 'Self-review is open',
        href: '/employee',
        urgency,
        primary: true,
      })
    } else {
      actions.push({
        label: 'Self-review submitted',
        description: 'Your review has been submitted. Your manager will review it next.',
        urgency: 'success',
        primary: true,
      })
    }
  }

  if (resolvedStatus === 'manager_review') {
    if (review?.status === 'submitted') {
      actions.push({
        label: 'Awaiting manager review',
        description: 'Your self-review has been submitted. Your manager is completing their assessment.',
        urgency: 'info',
        primary: true,
      })
    }
  }

  if (resolvedStatus === 'calibrating' || resolvedStatus === 'locked') {
    actions.push({
      label: 'Review in progress',
      description: resolvedStatus === 'calibrating'
        ? 'Your review is in the calibration stage. Results will be published soon.'
        : 'Reviews are locked. Results will be published shortly.',
      urgency: 'info',
      primary: true,
    })
  }

  if (resolvedStatus === 'published') {
    actions.push({
      label: 'Results published',
      description: 'Your review results are available. See your final rating below.',
      href: '/employee',
      urgency: 'success',
      primary: true,
    })
  }

  return actions
}

const URGENCY_GLOW: Record<UrgencyLevel, { boxShadow: string; borderColor: string; badgeBg: string; badgeText: string; label: string }> = {
  critical: {
    boxShadow: '0 0 20px oklch(0.65 0.25 25 / 0.3)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    badgeBg: 'bg-red-500/20',
    badgeText: 'text-red-400',
    label: 'Urgent',
  },
  warning: {
    boxShadow: '0 0 15px oklch(0.75 0.18 85 / 0.25)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-400',
    label: 'Action needed',
  },
  info: {
    boxShadow: '0 0 12px oklch(0.55 0.2 250 / 0.2)',
    borderColor: 'rgba(59, 130, 246, 0.2)',
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-400',
    label: 'In progress',
  },
  success: {
    boxShadow: '0 0 12px oklch(0.6 0.2 155 / 0.2)',
    borderColor: 'rgba(34, 197, 94, 0.2)',
    badgeBg: 'bg-green-500/20',
    badgeText: 'text-green-400',
    label: 'Complete',
  },
}

export function ActionInbox({ cycle, resolvedStatus, kpis, review }: ActionInboxProps) {
  const actions = computeActions(cycle, resolvedStatus, kpis, review)

  if (actions.length === 0) {
    const successGlow = URGENCY_GLOW.success
    return (
      <div
        className="glass rounded-lg border p-4 flex items-center gap-3"
        style={{ boxShadow: successGlow.boxShadow, borderColor: successGlow.borderColor }}
      >
        <span className="text-2xl">✅</span>
        <div>
          <p className="font-semibold text-green-400">All caught up!</p>
          <p className="text-sm text-green-400/70">No actions required right now.</p>
        </div>
      </div>
    )
  }

  const [primary, ...secondary] = actions

  return (
    <div className="space-y-2">
      {/* Primary action */}
      {primary && (
        <PrimaryActionCard action={primary} />
      )}
      {/* Secondary actions */}
      {secondary.map((action, i) => (
        <SecondaryActionCard key={i} action={action} />
      ))}
    </div>
  )
}

function PrimaryActionCard({ action }: { action: Action }) {
  const glow = URGENCY_GLOW[action.urgency]
  const Wrapper = action.href ? Link : 'div'

  return (
    <Wrapper
      // @ts-expect-error href only on Link
      href={action.href}
      className={cn(
        'block rounded-lg glass border p-4 transition-colors',
        action.href && 'hover:brightness-110 cursor-pointer'
      )}
      style={{ boxShadow: glow.boxShadow, borderColor: glow.borderColor }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{action.label}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{action.description}</p>
        </div>
        <span className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
          glow.badgeBg,
          glow.badgeText
        )}>
          {glow.label}
        </span>
      </div>
    </Wrapper>
  )
}

function SecondaryActionCard({ action }: { action: Action }) {
  const Wrapper = action.href ? Link : 'div'
  return (
    <Wrapper
      // @ts-expect-error href only on Link
      href={action.href}
      className={cn(
        'block rounded-md glass-interactive p-3 text-sm transition-colors',
        action.href && 'hover:brightness-110 cursor-pointer'
      )}
    >
      <span className="font-medium">{action.label}</span>
      <span className="ml-2 text-muted-foreground">{action.description}</span>
    </Wrapper>
  )
}
