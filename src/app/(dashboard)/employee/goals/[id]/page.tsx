import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { GoalProgressForm } from './progress-form'
import { GoalSubmitButton } from './submit-button'

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireRole(['employee'])

  const goal = await prisma.goal.findUnique({
    where: { id },
    include: { updates: { orderBy: { created_at: 'desc' } } },
  })

  if (!goal || goal.employee_id !== user.id) notFound()

  const progressPct = goal.target_value && goal.current_value
    ? Math.min(100, Math.round((Number(goal.current_value) / Number(goal.target_value)) * 100))
    : null

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{goal.title}</h1>
        {goal.description && <p className="text-muted-foreground">{goal.description}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Type</span><p className="font-medium capitalize">{goal.goal_type}</p></div>
        <div><span className="text-muted-foreground">Status</span><p className="font-medium capitalize">{goal.status}</p></div>
        <div><span className="text-muted-foreground">Weight</span><p className="font-medium">{goal.weight ? `${goal.weight}%` : '—'}</p></div>
        <div><span className="text-muted-foreground">Due</span><p className="font-medium">{goal.due_date ? String(goal.due_date).split('T')[0] : '—'}</p></div>
        {goal.target_value && (
          <div><span className="text-muted-foreground">Target</span><p className="font-medium">{String(goal.target_value)} {goal.unit ?? ''}</p></div>
        )}
        {goal.current_value !== null && (
          <div><span className="text-muted-foreground">Current</span><p className="font-medium">{String(goal.current_value)} {goal.unit ?? ''}</p></div>
        )}
      </div>

      {progressPct !== null && (
        <div className="space-y-1">
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{progressPct}% complete</p>
        </div>
      )}

      {goal.manager_comment && (
        <div className="rounded border border-amber-200 bg-amber-50/40 p-3 text-sm">
          <span className="font-medium">Manager comment: </span>{goal.manager_comment}
        </div>
      )}

      {goal.status === 'draft' && <GoalSubmitButton goalId={goal.id} />}
      {goal.status === 'approved' && <GoalProgressForm goalId={goal.id} currentValue={Number(goal.current_value ?? 0)} />}

      {goal.updates.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Progress History</h2>
          <div className="space-y-2">
            {goal.updates.map(u => (
              <div key={u.id} className="rounded border p-3 text-sm">
                <div className="flex justify-between">
                  <span>{u.previous_value !== null ? `${String(u.previous_value)} → ` : ''}{String(u.new_value)} {goal.unit ?? ''}</span>
                  <span className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</span>
                </div>
                {u.note && <p className="text-xs text-muted-foreground mt-1">{u.note}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
