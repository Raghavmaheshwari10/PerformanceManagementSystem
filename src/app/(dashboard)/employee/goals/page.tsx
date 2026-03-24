import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { GoalForm } from './goal-form'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  completed: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-muted text-muted-foreground',
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
            <p className="text-sm text-muted-foreground rounded border border-dashed p-6 text-center">
              No goals yet. Add your first goal below.
            </p>
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
                    className="block rounded border p-4 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 flex-1">
                        <p className="font-medium">{goal.title}</p>
                        {goal.description && (
                          <p className="text-xs text-muted-foreground">{goal.description}</p>
                        )}
                        {progress !== null && (
                          <div className="mt-2 space-y-1">
                            <div className="h-1.5 w-full max-w-xs rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {String(goal.current_value)}/{String(goal.target_value)} {goal.unit} ({progress}%)
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {goal.weight && (
                          <span className="text-xs bg-muted rounded-full px-2 py-0.5">{String(goal.weight)}%</span>
                        )}
                        <span className={cn('text-xs rounded-full px-2 py-0.5', STATUS_COLORS[goal.status] ?? 'bg-muted')}>
                          {goal.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          <section className="rounded border p-4 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Add Goal</h2>
            <GoalForm cycleId={cycle.id} />
          </section>
        </>
      )}
    </div>
  )
}
