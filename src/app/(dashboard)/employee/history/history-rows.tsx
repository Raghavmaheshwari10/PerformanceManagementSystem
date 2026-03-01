'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Appraisal, Cycle } from '@/lib/types'

interface AppraisalWithCycle extends Appraisal { cycles: Cycle }

interface HistoryRow {
  appraisal: AppraisalWithCycle
  selfReview: { rating: string | null; comments: string | null } | null
  trend: 'up' | 'down' | 'same' | null
}

const RATING_COLORS: Record<string, string> = {
  FEE: 'text-emerald-700 bg-emerald-50',
  EE:  'text-blue-700 bg-blue-50',
  ME:  'text-foreground bg-muted',
  SME: 'text-amber-700 bg-amber-50',
  BE:  'text-destructive bg-destructive/10',
}

const TREND_ICONS: Record<string, string> = {
  up:   '↑',
  down: '↓',
  same: '→',
}

const TREND_COLORS: Record<string, string> = {
  up:   'text-green-600',
  down: 'text-destructive',
  same: 'text-muted-foreground',
}

export function HistoryRows({ rows }: { rows: HistoryRow[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-2">
      {rows.map(({ appraisal: a, selfReview, trend }) => {
        const isOpen = expanded.has(a.id)
        const finalColor = a.final_rating ? (RATING_COLORS[a.final_rating] ?? 'bg-muted') : 'bg-muted'

        return (
          <div key={a.id} className="rounded-lg border overflow-hidden">
            {/* Summary row — click to expand */}
            <button
              type="button"
              onClick={() => toggle(a.id)}
              className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
            >
              {/* Cycle name */}
              <div className="flex-1">
                <p className="font-medium text-sm">{a.cycles.name}</p>
                <p className="text-xs text-muted-foreground">{a.cycles.quarter} · {a.cycles.year}</p>
              </div>

              {/* Final rating badge */}
              <span className={cn('rounded-full px-3 py-0.5 text-xs font-bold', finalColor)}>
                {a.final_rating ?? '—'}
              </span>

              {/* Trend indicator */}
              {trend && (
                <span className={cn('text-sm font-bold', TREND_COLORS[trend])}>
                  {TREND_ICONS[trend]}
                </span>
              )}

              {/* Payout */}
              {a.payout_amount != null ? (
                <span className="text-sm font-medium tabular-nums">
                  ₹{a.payout_amount.toLocaleString()}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">No payout</span>
              )}

              {/* Chevron */}
              <span className="text-muted-foreground text-xs shrink-0">
                {isOpen ? '▲' : '▼'}
              </span>
            </button>

            {/* Expanded detail */}
            {isOpen && (
              <div className="border-t px-4 pb-4 pt-3 space-y-4 bg-muted/10">
                {/* Ratings comparison */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded border bg-background p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Self Rating</p>
                    <p className="font-semibold">{selfReview?.rating ?? '—'}</p>
                  </div>
                  <div className="rounded border bg-background p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Manager Rating</p>
                    <p className="font-semibold">{a.manager_rating ?? '—'}</p>
                  </div>
                  <div className="rounded border bg-background p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Final Rating</p>
                    <p className={cn('font-bold', a.final_rating ? RATING_COLORS[a.final_rating]?.split(' ')[0] : '')}>
                      {a.final_rating ?? '—'}
                    </p>
                  </div>
                </div>

                {/* Self comments */}
                {selfReview?.comments && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Your Self-Assessment</p>
                    <p className="text-sm whitespace-pre-wrap rounded border bg-background p-3">
                      {selfReview.comments}
                    </p>
                  </div>
                )}

                {/* Manager comments */}
                {a.manager_comments && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Manager Feedback</p>
                    <p className="text-sm whitespace-pre-wrap rounded border bg-background p-3">
                      {a.manager_comments}
                    </p>
                  </div>
                )}

                {/* Compensation breakdown */}
                {a.payout_amount != null && (
                  <div className="rounded border bg-background p-3 space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      How this was calculated
                    </p>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Variable pay base</span>
                        <span className="font-medium">₹{(a.snapshotted_variable_pay ?? 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Individual multiplier ({a.final_rating})</span>
                        <span className="font-medium">{((a.payout_multiplier ?? 0) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between border-t pt-1 mt-1">
                        <span className="font-medium">Payout</span>
                        <span className="font-bold">₹{a.payout_amount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
