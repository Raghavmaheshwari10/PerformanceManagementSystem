import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { GoalForm } from './goal-form'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted/50 text-muted-foreground',
  submitted: 'bg-blue-500/15 text-blue-400',
  approved: 'bg-green-500/15 text-green-400',
  rejected: 'bg-red-500/15 text-red-400',
  completed: 'bg-emerald-500/15 text-emerald-400',
  closed: 'bg-muted/50 text-muted-foreground',
}

export default async function EmployeeGoalsPage() {
  const user = await requireRole(['employee'])

  const cycle = await prisma.cycle.findFirst({
    where: { status: { not: 'draft' } },
    orderBy: { created_at: 'desc' },
  })

  const goals = cycle
    ? await prisma.goal.findMany({
        where: { cycle_id: cycle.id, employee_id: user.id },
        orderBy: { created_at: 'asc' },
      })
    : []

  const totalWeight = goals.reduce((s, g) => s + Number(g.weight ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Goals</h1>
        {cycle && (
          <span className="text-sm text-muted-foreground">{cycle.name} · Total weight: {totalWeight}%</span>
        )}
      </div>

      {!cycle && <p className="text-muted-foreground">No active review cycle.</p>}

      {cycle && (
        <>
          {goals.length === 0 ? (
            <div className="glass border border-dashed border-border p-10 text-center">
              <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit mb-3">
                <svg className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
                </svg>
              </div>
              <p className="text-sm font-semibold mb-1">No goals yet</p>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">Set your first goal for this cycle using the form below. Goals help track your progress and align with team objectives.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {goals.map(goal => {
                const progress = goal.target_value && goal.current_value
                  ? Math.min(100, Math.round((Number(goal.current_value) / Number(goal.target_value)) * 100))
                  : null
                return (
                  <Link
                    key={goal.id}
                    href={`/employee/goals/${goal.id}`}
                    className="glass-interactive p-4 block transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <p className="font-medium">{goal.title}</p>
                        {goal.description && (
                          <p className="text-xs text-muted-foreground">{goal.description}</p>
                        )}
                        {progress !== null && (
                          <div className="mt-2 space-y-1">
                            <div className="h-1.5 w-full max-w-xs rounded-full bg-muted/30 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 animate-[barGrow_0.6s_ease-out]"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {String(goal.current_value)}/{String(goal.target_value)} {goal.unit} ({progress}%)
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {goal.weight && (
                          <span className="text-xs bg-muted/50 rounded-full px-2 py-0.5">{String(goal.weight)}%</span>
                        )}
                        <span className={cn('text-xs rounded-full px-2 py-0.5', STATUS_COLORS[goal.status] ?? 'bg-muted/50')}>
                          {goal.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          <section className="glass p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Add Goal</h2>
            <GoalForm cycleId={cycle.id} />
          </section>
        </>
      )}
    </div>
  )
}
