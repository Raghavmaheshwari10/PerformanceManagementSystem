import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { Cycle, Kpi, Review } from '@/lib/types'

interface ActionInboxProps {
  cycle: Cycle
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

function computeActions(cycle: Cycle, kpis: Kpi[], review: Review | null): Action[] {
  const actions: Action[] = []

  if (cycle.status === 'kpi_setting') {
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

  if (cycle.status === 'self_review') {
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

  if (cycle.status === 'manager_review') {
    if (review?.status === 'submitted') {
      actions.push({
        label: 'Awaiting manager review',
        description: 'Your self-review has been submitted. Your manager is completing their assessment.',
        urgency: 'info',
        primary: true,
      })
    }
  }

  if (cycle.status === 'calibrating' || cycle.status === 'locked') {
    actions.push({
      label: 'Review in progress',
      description: cycle.status === 'calibrating'
        ? 'Your review is in the calibration stage. Results will be published soon.'
        : 'Reviews are locked. Results will be published shortly.',
      urgency: 'info',
      primary: true,
    })
  }

  if (cycle.status === 'published') {
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

const URGENCY_STYLES: Record<UrgencyLevel, { border: string; bg: string; badge: string; badgeText: string }> = {
  critical: {
    border: 'border-destructive/50',
    bg: 'bg-destructive/5',
    badge: 'bg-destructive',
    badgeText: 'Urgent',
  },
  warning: {
    border: 'border-amber-400/50',
    bg: 'bg-amber-50',
    badge: 'bg-amber-500',
    badgeText: 'Action needed',
  },
  info: {
    border: 'border-blue-300/50',
    bg: 'bg-blue-50/60',
    badge: 'bg-blue-500',
    badgeText: 'In progress',
  },
  success: {
    border: 'border-green-400/50',
    bg: 'bg-green-50',
    badge: 'bg-green-600',
    badgeText: 'Complete',
  },
}

export function ActionInbox({ cycle, kpis, review }: ActionInboxProps) {
  const actions = computeActions(cycle, kpis, review)

  if (actions.length === 0) {
    return (
      <div className="rounded-lg border border-green-300/50 bg-green-50 p-4 flex items-center gap-3">
        <span className="text-2xl">✅</span>
        <div>
          <p className="font-semibold text-green-800">All caught up!</p>
          <p className="text-sm text-green-700">No actions required right now.</p>
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
  const styles = URGENCY_STYLES[action.urgency]
  const Wrapper = action.href ? Link : 'div'

  return (
    <Wrapper
      // @ts-expect-error href only on Link
      href={action.href}
      className={cn(
        'block rounded-lg border-2 p-4 transition-colors',
        styles.border,
        styles.bg,
        action.href && 'hover:brightness-95 cursor-pointer'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{action.label}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{action.description}</p>
        </div>
        <span className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white',
          styles.badge
        )}>
          {styles.badgeText}
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
        'block rounded-md border p-3 text-sm transition-colors',
        action.href && 'hover:bg-muted cursor-pointer'
      )}
    >
      <span className="font-medium">{action.label}</span>
      <span className="ml-2 text-muted-foreground">{action.description}</span>
    </Wrapper>
  )
}
