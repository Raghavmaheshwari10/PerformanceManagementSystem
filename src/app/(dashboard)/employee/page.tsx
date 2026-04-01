import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { getVisibleCycleForUser, getStatusForEmployee } from '@/lib/cycle-helpers'
import { CycleStatusBadge } from '@/components/cycle-status-badge'
import { DeadlineBanner } from '@/components/deadline-banner'
import { SelfReviewForm } from './self-review-form'
import { PayoutBreakdown } from '@/components/payout-breakdown'
import { CycleTimeline } from '@/components/cycle-timeline'
import type { Cycle, Kpi, Kra, Review, Appraisal, ReviewQuestionWithCompetency } from '@/lib/types'

/* ── Action computation (inlined from action-inbox) ── */

type UrgencyLevel = 'critical' | 'warning' | 'info' | 'success'

interface HeroAction {
  label: string
  description: string
  href?: string
  urgency: UrgencyLevel
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function computePrimaryAction(status: string, cycle: Cycle, kpis: Kpi[], review: Review | null): HeroAction {
  if (status === 'kpi_setting') {
    const days = daysUntil(cycle.kpi_setting_deadline)
    const urgency: UrgencyLevel =
      days === null ? 'info' :
      days < 0 ? 'critical' :
      days <= 2 ? 'critical' :
      days <= 5 ? 'warning' : 'info'

    if (kpis.length === 0) {
      return {
        label: 'No KPIs assigned yet',
        description: 'Your manager hasn\'t set up KPIs for this cycle. Check back soon.',
        urgency: 'info',
      }
    }
    return {
      label: 'Review your KPIs',
      description: days !== null
        ? days < 0 ? `KPI setting deadline was ${Math.abs(days)} day(s) ago`
        : days === 0 ? 'KPI setting deadline is today'
        : `KPI setting deadline in ${days} day(s)`
        : 'KPI setting is open',
      urgency,
    }
  }

  if (status === 'self_review') {
    const days = daysUntil(cycle.self_review_deadline)
    const urgency: UrgencyLevel =
      days === null ? 'info' :
      days < 0 ? 'critical' :
      days <= 2 ? 'critical' :
      days <= 5 ? 'warning' : 'info'

    if (!review || review.status === 'draft') {
      return {
        label: 'Complete your self-review',
        description: days !== null
          ? days < 0 ? `Deadline was ${Math.abs(days)} day(s) ago — submit now`
          : days === 0 ? 'Due today — don\'t miss it'
          : `Due in ${days} day(s)`
          : 'Self-review is open',
        href: '#self-review-form',
        urgency,
      }
    }
    return {
      label: 'Self-review submitted',
      description: 'Your review has been submitted. You can still edit and re-submit below until the self-review phase ends.',
      href: '#self-review-form',
      urgency: 'success',
    }
  }

  if (status === 'manager_review') {
    return {
      label: 'Awaiting manager review',
      description: 'Your self-review has been submitted. Your manager is completing their assessment.',
      urgency: 'info',
    }
  }

  if (status === 'calibrating' || status === 'locked') {
    return {
      label: 'Review in progress',
      description: status === 'calibrating'
        ? 'Your review is in the calibration stage. Results will be published soon.'
        : 'Reviews are locked. Results will be published shortly.',
      urgency: 'info',
    }
  }

  if (status === 'published') {
    return {
      label: 'Results published',
      description: 'Your review results are available. See your final rating below.',
      urgency: 'success',
    }
  }

  return {
    label: 'All caught up',
    description: 'No actions required right now.',
    urgency: 'success',
  }
}

/* ── Urgency style maps ── */

const URGENCY_GLOW: Record<UrgencyLevel, string> = {
  critical: '0 0 20px oklch(0.65 0.25 25 / 0.3)',
  warning:  '0 0 20px oklch(0.75 0.18 85 / 0.3)',
  info:     '0 0 15px oklch(0.55 0.2 250 / 0.2)',
  success:  '0 0 15px oklch(0.6 0.2 155 / 0.2)',
}

const URGENCY_BADGE: Record<UrgencyLevel, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-500/20',    text: 'text-red-400',    label: 'Urgent' },
  warning:  { bg: 'bg-amber-500/20',  text: 'text-amber-400',  label: 'Action needed' },
  info:     { bg: 'bg-blue-500/20',   text: 'text-blue-400',   label: 'In progress' },
  success:  { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Complete' },
}

/* ── Rating display config ── */

const RATING_LABELS: Record<string, { label: string; color: string }> = {
  FEE: { label: 'Far Exceeds Expectations', color: 'text-emerald-400' },
  EE:  { label: 'Exceeds Expectations',     color: 'text-green-400' },
  ME:  { label: 'Meets Expectations',        color: 'text-blue-400' },
  SME: { label: 'Slightly Meets Expectations', color: 'text-amber-400' },
  BE:  { label: 'Below Expectations',        color: 'text-red-400' },
}

/* ── Page ── */

export default async function EmployeeReviewPage() {
  const user = await requireRole(['employee'])

  const cycle = await getVisibleCycleForUser(user.id)
  const resolvedStatus = cycle ? await getStatusForEmployee(cycle.id, user.id) : null

  if (!cycle || !resolvedStatus) return (
    <div className="glass flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted/30 p-4 mb-4">
        <svg className="h-8 w-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h3 className="text-lg font-semibold mb-1">No Active Cycle</h3>
      <p className="text-sm text-muted-foreground max-w-xs">There&apos;s no review cycle in progress right now. Your HR team will notify you when the next cycle begins.</p>
    </div>
  )

  const [kpis, kras, review, appraisal, misTargets, activeTemplate] = await Promise.all([
    prisma.kpi.findMany({
      where: { cycle_id: cycle.id, employee_id: user.id },
      include: { kra: true },
    }),
    prisma.kra.findMany({
      where: { cycle_id: cycle.id, employee_id: user.id },
      orderBy: { sort_order: 'asc' },
    }),
    prisma.review.findFirst({
      where: { cycle_id: cycle.id, employee_id: user.id },
    }),
    prisma.appraisal.findFirst({
      where: { cycle_id: cycle.id, employee_id: user.id },
    }),
    prisma.aopTarget.findMany({
      where: { employee_id: user.id, fiscal_year: new Date().getFullYear(), level: 'individual' },
      take: 3,
      orderBy: { metric_name: 'asc' },
    }),
    prisma.reviewTemplate.findFirst({
      orderBy: { created_at: 'desc' },
      include: {
        questions: {
          orderBy: { order_index: 'asc' },
          include: { competency: true },
        },
      },
    }),
  ])

  // Fetch existing responses if user has a review
  const existingResponses: Record<string, { rating_value: number | null; text_value: string | null }> = {}
  if (review) {
    const responses = await prisma.reviewResponse.findMany({
      where: { review_id: review.id, respondent_id: user.id },
      select: { question_id: true, rating_value: true, text_value: true },
    })
    for (const r of responses) {
      existingResponses[r.question_id] = { rating_value: r.rating_value, text_value: r.text_value }
    }
  }

  const templateQuestions: ReviewQuestionWithCompetency[] = activeTemplate?.questions
    ? activeTemplate.questions.map(q => ({
        id: q.id,
        template_id: q.template_id,
        competency_id: q.competency_id,
        question_text: q.question_text,
        answer_type: q.answer_type as ReviewQuestionWithCompetency['answer_type'],
        is_required: q.is_required,
        order_index: q.order_index,
        competency: q.competency ? {
          id: q.competency.id,
          name: q.competency.name,
          description: q.competency.description,
          created_at: q.competency.created_at.toISOString(),
        } : null,
      }))
    : []

  // Serialize Prisma Decimals to plain numbers for client components
  const serializedKpis: Kpi[] = kpis.map(k => ({
    ...k,
    weight: k.weight !== null ? Number(k.weight) : null,
    target: k.target != null ? Number(k.target) : null,
    kra: k.kra ? { ...k.kra, weight: k.kra.weight !== null ? Number(k.kra.weight) : null } : undefined,
  })) as unknown as Kpi[]

  const serializedKras: Kra[] = kras.map(k => ({
    ...k,
    weight: k.weight !== null ? Number(k.weight) : null,
  })) as unknown as Kra[]

  /* ── Group KPIs by KRA ── */
  const hasKras = serializedKras.length > 0
  const kpisByKra = new Map<string | null, Kpi[]>()
  for (const kpi of serializedKpis) {
    const key = kpi.kra_id ?? null
    if (!kpisByKra.has(key)) kpisByKra.set(key, [])
    kpisByKra.get(key)!.push(kpi)
  }
  const ungroupedKpis = kpisByKra.get(null) ?? []

  const KRA_CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
    performance: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    behaviour:   { bg: 'bg-amber-500/20', text: 'text-amber-400' },
    learning:    { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  }

  const isSelfReview = resolvedStatus === 'self_review'
  const isPublished = resolvedStatus === 'published'

  const heroAction = computePrimaryAction(
    resolvedStatus,
    cycle as unknown as Cycle,
    serializedKpis,
    review as unknown as Review | null,
  )

  const badge = URGENCY_BADGE[heroAction.urgency]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">My Review — {cycle.name}</h1>
        <CycleStatusBadge status={resolvedStatus} />
      </div>

      {isSelfReview && (
        <DeadlineBanner deadline={cycle.self_review_deadline ? String(cycle.self_review_deadline) : null} label="Self-review" />
      )}

      {/* ── Zone 1: Hero Action Card ── */}
      <div
        data-tour="action-inbox"
        className="glass relative overflow-hidden px-6 py-8 sm:px-8"
        style={{ boxShadow: URGENCY_GLOW[heroAction.urgency] }}
      >
        {/* Subtle shimmer overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(120deg, transparent 30%, oklch(1 0 0 / 0.15) 50%, transparent 70%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 8s ease-in-out infinite',
        }} />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            {/* Urgency badge */}
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.bg} ${badge.text}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {badge.label}
            </span>

            {/* Primary label */}
            <h2 className="text-xl font-bold sm:text-2xl">{heroAction.label}</h2>

            {/* Description */}
            <p className="text-sm text-muted-foreground max-w-lg">{heroAction.description}</p>
          </div>

          {/* CTA button */}
          {heroAction.href && (
            <Link
              href={heroAction.href}
              className="glow-button shrink-0 self-start sm:self-center px-6 py-2.5 text-sm font-semibold rounded-lg"
            >
              Take Action
            </Link>
          )}
        </div>
      </div>

      {/* ── Gradient divider ── */}
      <div className="gradient-divider" />

      {/* ── Zone 2: KPIs + Cycle Timeline ── */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: KPI cards (3 cols) */}
        <section className="lg:col-span-3 space-y-3" data-tour="kpi-list">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your KRAs &amp; KPIs
          </h2>

          {kpis.length === 0 ? (
            <div className="glass flex flex-col items-center justify-center py-10 text-center">
              <div className="rounded-full bg-muted/30 p-3 mb-3">
                <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-sm font-medium mb-1">No KPIs assigned yet</p>
              <p className="text-xs text-muted-foreground">Your manager will set up KPIs for this cycle. Check back soon.</p>
            </div>
          ) : !hasKras ? (
            /* Flat list when no KRAs exist (backwards compatible) */
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {serializedKpis.map(kpi => {
                const weight = Number(kpi.weight ?? 0)
                return (
                  <div key={kpi.id} className="glass-interactive p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm leading-snug">{kpi.title}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {kpi.target != null && (
                            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                              Target: {kpi.unit === 'percent' ? `${kpi.target}%` : String(kpi.target)}
                            </span>
                          )}
                          <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                            {String(kpi.weight)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    {kpi.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{kpi.description}</p>
                    )}
                    <div className="space-y-1">
                      <div className="h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(weight, 100)}%`,
                            background: 'linear-gradient(90deg, oklch(0.65 0.22 265), oklch(0.7 0.18 280))',
                            animation: 'barGrow 0.8s ease-out forwards',
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground tabular-nums">Weight: {String(kpi.weight)}%</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* Grouped by KRA */
            <div className="space-y-4">
              {serializedKras.map(kra => {
                const kraKpis = (kpisByKra.get(kra.id) ?? []) as unknown as Kpi[]
                const catStyle = KRA_CATEGORY_STYLES[kra.category] ?? KRA_CATEGORY_STYLES.performance
                const kraWeight = Number(kra.weight ?? 0)
                return (
                  <div key={kra.id} className="glass p-4 space-y-3">
                    {/* KRA header */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary tracking-wide">KRA</span>
                        <h3 className="font-semibold text-sm">{kra.title}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${catStyle.bg} ${catStyle.text}`}>
                          {kra.category}
                        </span>
                      </div>
                      <span className="shrink-0 rounded-full bg-muted/50 px-2 py-0.5 text-xs font-semibold tabular-nums">
                        {kraWeight}%
                      </span>
                    </div>
                    {kra.description && (
                      <p className="text-xs text-muted-foreground">{kra.description}</p>
                    )}
                    {/* KPIs within this KRA */}
                    {kraKpis.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No KPIs assigned to this KRA yet.</p>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {kraKpis.map(kpi => {
                          const weight = Number(kpi.weight ?? 0)
                          return (
                            <div key={kpi.id} className="glass-interactive p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-medium text-sm leading-snug">{kpi.title}</p>
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    {kpi.target != null && (
                                      <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                                        Target: {kpi.unit === 'percent' ? `${kpi.target}%` : String(kpi.target)}
                                      </span>
                                    )}
                                    <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                                      {String(kpi.weight)}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {kpi.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">{kpi.description}</p>
                              )}
                              <div className="space-y-1">
                                <div className="h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${Math.min(weight, 100)}%`,
                                      background: 'linear-gradient(90deg, oklch(0.65 0.22 265), oklch(0.7 0.18 280))',
                                      animation: 'barGrow 0.8s ease-out forwards',
                                    }}
                                  />
                                </div>
                                <p className="text-[10px] text-muted-foreground tabular-nums">Weight: {String(kpi.weight)}%</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Ungrouped KPIs */}
              {ungroupedKpis.length > 0 && (
                <div className="glass p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">General KPIs</h3>
                    <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      Unassigned
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {ungroupedKpis.map(kpi => {
                      const weight = Number(kpi.weight ?? 0)
                      return (
                        <div key={kpi.id} className="glass-interactive p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm leading-snug">{kpi.title}</p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {kpi.target != null && (
                                  <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                                    Target: {kpi.unit === 'percent' ? `${kpi.target}%` : String(kpi.target)}
                                  </span>
                                )}
                                <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                                  {String(kpi.weight)}%
                                </span>
                              </div>
                            </div>
                          </div>
                          {kpi.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{kpi.description}</p>
                          )}
                          <div className="space-y-1">
                            <div className="h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(weight, 100)}%`,
                                  background: 'linear-gradient(90deg, oklch(0.65 0.22 265), oklch(0.7 0.18 280))',
                                  animation: 'barGrow 0.8s ease-out forwards',
                                }}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground tabular-nums">Weight: {String(kpi.weight)}%</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right: Cycle Timeline (2 cols) */}
        <section className="lg:col-span-2 glass p-5">
          <CycleTimeline currentStatus={resolvedStatus} />
        </section>
      </div>

      {/* ── MIS Performance Summary ── */}
      {misTargets.length > 0 && (() => {
        const now = new Date()
        const startOfYear = new Date(now.getFullYear(), 0, 1)
        const endOfYear = new Date(now.getFullYear(), 11, 31)
        const totalDays = (endOfYear.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
        const elapsedDays = (now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
        const proRataFactor = elapsedDays / totalDays

        return (
          <section className="glass p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                MIS Performance
              </h2>
              <Link
                href="/employee/mis"
                className="text-xs font-medium text-sidebar-primary hover:underline"
              >
                View all &rarr;
              </Link>
            </div>
            <div className="space-y-3">
              {misTargets.map(target => {
                const annualTarget = Number(target.annual_target)
                const proratedTarget = annualTarget * proRataFactor
                const actual = Number(target.ytd_actual ?? 0)
                const pct = proratedTarget > 0 ? Math.round((actual / proratedTarget) * 100) : 0
                const clampedPct = Math.min(pct, 100)

                const redThreshold = Number(target.red_threshold)
                const amberThreshold = Number(target.amber_threshold)
                const rag: 'red' | 'amber' | 'green' =
                  pct < redThreshold ? 'red' :
                  pct < amberThreshold ? 'amber' : 'green'
                const ragStyles = {
                  red:   { bg: 'bg-red-500/20', text: 'text-red-400', bar: 'oklch(0.65 0.25 25)' },
                  amber: { bg: 'bg-amber-500/20', text: 'text-amber-400', bar: 'oklch(0.75 0.18 85)' },
                  green: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', bar: 'oklch(0.65 0.2 155)' },
                }
                const style = ragStyles[rag]

                return (
                  <div key={target.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{target.metric_name}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-semibold tabular-nums">{pct}%</span>
                          <span className={`inline-flex h-2 w-2 rounded-full ${style.bg} ring-1 ring-current ${style.text}`} />
                        </div>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${clampedPct}%`,
                            background: style.bar,
                            animation: 'barGrow 0.8s ease-out forwards',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })()}

      {/* ── Self-review form ── */}
      {isSelfReview && (
        <div id="self-review-form" data-tour="self-review-form">
          <SelfReviewForm
            cycleId={cycle.id}
            review={review as unknown as Review | null}
            kpis={serializedKpis}
            kras={serializedKras}
            questions={templateQuestions}
            existingResponses={existingResponses}
          />
        </div>
      )}

      {/* ── Final Results ── */}
      {isPublished && appraisal && (() => {
        const ratingKey = appraisal.final_rating ?? ''
        const ratingInfo = RATING_LABELS[ratingKey]
        return (
          <section className="glass glass-glow p-6 space-y-4">
            <h2 className="text-lg font-semibold">Final Result</h2>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Large rating display */}
              <div className="flex items-center gap-3">
                <span className={`text-4xl font-black tracking-tight ${ratingInfo?.color ?? 'text-foreground'}`}>
                  {ratingKey || '—'}
                </span>
                {ratingInfo && (
                  <span className="text-sm text-muted-foreground">{ratingInfo.label}</span>
                )}
              </div>
            </div>

            {appraisal.payout_amount != null && (
              <div className="pt-2">
                <div className="gradient-divider mb-4" />
                <PayoutBreakdown
                  snapshottedVariablePay={Number(appraisal.snapshotted_variable_pay ?? 0)}
                  rating={appraisal.final_rating ?? ''}
                  individualMultiplier={Number(appraisal.payout_multiplier ?? 0)}
                  businessMultiplier={Number(cycle.business_multiplier ?? 1)}
                  payoutAmount={Number(appraisal.payout_amount)}
                />
              </div>
            )}
          </section>
        )
      })()}
    </div>
  )
}
