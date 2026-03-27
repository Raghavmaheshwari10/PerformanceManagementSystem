import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import type { AopTarget, MisActual } from '@prisma/client'

/* ── Category styling ── */

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  financial:   { bg: 'bg-blue-500/20',    text: 'text-blue-400' },
  operational: { bg: 'bg-purple-500/20',   text: 'text-purple-400' },
  people:      { bg: 'bg-emerald-500/20',  text: 'text-emerald-400' },
  customer:    { bg: 'bg-amber-500/20',    text: 'text-amber-400' },
  process:     { bg: 'bg-slate-400/20',    text: 'text-slate-400' },
}

const CATEGORIES = ['all', 'financial', 'operational', 'people', 'customer', 'process'] as const

/* ── RAG helpers ── */

function computeAchievement(ytdActual: number, annualTarget: number, currentMonth: number): number {
  const proRatedTarget = (annualTarget * currentMonth) / 12
  if (proRatedTarget === 0) return 0
  return (ytdActual / proRatedTarget) * 100
}

function ragColor(achievement: number, amberThreshold: number, redThreshold: number) {
  if (achievement >= amberThreshold) return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'On Track' }
  if (achievement >= redThreshold)   return { bg: 'bg-amber-500/20',   text: 'text-amber-400',  label: 'At Risk' }
  return { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Off Track' }
}

/* ── SVG Bar Chart ── */

function MisBarChart({ target, actuals }: { target: AopTarget; actuals: MisActual[] }) {
  const monthlyTargets = (target.monthly_targets as Record<string, number> | null) ?? {}
  const currentMonth = new Date().getMonth() + 1
  const barWidth = 28
  const gap = 8
  const chartWidth = 12 * (barWidth + gap)
  const chartHeight = 100

  // Find max value for scaling
  const actualValues = actuals.map(a => Number(a.actual_value))
  const targetValues = Object.values(monthlyTargets).map(Number)
  const fallbackMonthly = Number(target.annual_target) / 12
  const allValues = [...actualValues, ...targetValues, fallbackMonthly]
  const maxVal = Math.max(...allValues, 1)

  const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

  return (
    <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 20}`} className="w-full h-28" aria-label="12-month actuals chart">
      {/* Target dots (dashed reference) */}
      {Array.from({ length: 12 }, (_, i) => {
        const m = i + 1
        const targetVal = Number(monthlyTargets[String(m)] ?? fallbackMonthly)
        const y = chartHeight - (targetVal / maxVal) * chartHeight
        return (
          <circle
            key={`t-${m}`}
            cx={i * (barWidth + gap) + barWidth / 2}
            cy={y}
            r="2"
            className="fill-white/30"
          />
        )
      })}
      {/* Dashed line connecting target dots */}
      <polyline
        points={Array.from({ length: 12 }, (_, i) => {
          const m = i + 1
          const targetVal = Number(monthlyTargets[String(m)] ?? fallbackMonthly)
          const y = chartHeight - (targetVal / maxVal) * chartHeight
          const x = i * (barWidth + gap) + barWidth / 2
          return `${x},${y}`
        }).join(' ')}
        fill="none"
        stroke="oklch(1 0 0 / 0.15)"
        strokeWidth="1"
        strokeDasharray="4 3"
      />
      {/* Actual bars */}
      {Array.from({ length: 12 }, (_, i) => {
        const m = i + 1
        const actual = actuals.find(a => a.month === m)
        if (!actual || m > currentMonth) return null
        const val = Number(actual.actual_value)
        const h = (val / maxVal) * chartHeight
        const isCurrent = m === currentMonth
        return (
          <rect
            key={`b-${m}`}
            x={i * (barWidth + gap)}
            y={chartHeight - h}
            width={barWidth}
            height={h}
            rx="4"
            className={isCurrent ? 'fill-primary' : 'fill-white/20'}
            style={{ animation: `barGrow 0.8s ease-out ${i * 60}ms both` }}
          />
        )
      })}
      {/* Month labels */}
      {months.map((l, i) => (
        <text
          key={`l-${i}`}
          x={i * (barWidth + gap) + barWidth / 2}
          y={chartHeight + 14}
          textAnchor="middle"
          className="fill-white/40 text-[8px]"
        >
          {l}
        </text>
      ))}
    </svg>
  )
}

/* ── Page ── */

export default async function EmployeeMisPage(props: {
  searchParams: Promise<{ category?: string }>
}) {
  const user = await requireRole(['employee'])
  const searchParams = await props.searchParams
  const activeCategory = searchParams?.category ?? 'all'

  // Get fiscal year from MisConfig
  const config = await prisma.misConfig.findFirst()
  const fiscalYear = config?.fiscal_year ?? new Date().getFullYear()

  // Fetch employee's individual AOP targets
  const targets = await prisma.aopTarget.findMany({
    where: { employee_id: user.id, fiscal_year: fiscalYear },
    include: { actuals: { orderBy: { month: 'asc' } } },
    orderBy: { metric_name: 'asc' },
  })

  const currentMonth = new Date().getMonth() + 1

  // Filter by category
  const filtered = activeCategory === 'all'
    ? targets
    : targets.filter(t => t.category === activeCategory)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">My MIS Targets</h1>
        <p className="text-sm text-muted-foreground">
          FY {fiscalYear} &middot; {targets.length} metric{targets.length !== 1 ? 's' : ''} assigned
        </p>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => {
          const isActive = activeCategory === cat
          const style = cat === 'all' ? null : CATEGORY_STYLES[cat]
          return (
            <Link
              key={cat}
              href={cat === 'all' ? '/employee/mis' : `/employee/mis?category=${cat}`}
              className={`
                rounded-full px-3 py-1 text-xs font-semibold capitalize transition-all
                ${isActive
                  ? 'bg-white/15 text-white ring-1 ring-white/20'
                  : style
                    ? `${style.bg} ${style.text} hover:brightness-125`
                    : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                }
              `}
            >
              {cat}
            </Link>
          )
        })}
      </div>

      {/* Targets grid */}
      {filtered.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-white/5 p-4 mb-4">
            <svg className="h-8 w-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-1">No MIS targets assigned yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Your targets will appear here once synced from the MIS system.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(target => {
            const annualTarget = Number(target.annual_target)
            const ytdActual = Number(target.ytd_actual ?? 0)
            const amberThreshold = Number(target.amber_threshold)
            const redThreshold = Number(target.red_threshold)
            const achievement = computeAchievement(ytdActual, annualTarget, currentMonth)
            const rag = ragColor(achievement, amberThreshold, redThreshold)
            const catStyle = CATEGORY_STYLES[target.category] ?? CATEGORY_STYLES.financial

            return (
              <div key={target.id} className="glass p-4 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-semibold text-sm leading-snug">{target.metric_name}</p>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${catStyle.bg} ${catStyle.text}`}>
                        {target.category}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        {target.unit}{target.currency ? ` (${target.currency})` : ''}
                      </span>
                    </div>
                  </div>
                  {/* RAG badge */}
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${rag.bg} ${rag.text}`}>
                    {rag.label}
                  </span>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Target</p>
                    <p className="text-sm font-semibold tabular-nums">{annualTarget.toLocaleString()}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">YTD Actual</p>
                    <p className="text-sm font-semibold tabular-nums">{ytdActual.toLocaleString()}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Achievement</p>
                    <p
                      className={`text-sm font-bold tabular-nums ${rag.text}`}
                      style={{ animation: 'countUp 0.6s ease-out both' }}
                    >
                      {achievement.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* 12-month bar chart */}
                <MisBarChart target={target} actuals={target.actuals} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
