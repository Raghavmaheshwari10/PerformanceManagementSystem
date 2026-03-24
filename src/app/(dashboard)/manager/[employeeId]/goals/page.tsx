import { prisma } from '@/lib/prisma'
import { requireRole, requireManagerOwnership } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { GoalApprovalRow } from './goal-approval-row'

export default async function ManagerEmployeeGoalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>
  searchParams: Promise<{ cycle?: string }>
}) {
  const { employeeId } = await params
  const { cycle: cycleIdParam } = await searchParams
  const manager = await requireRole(['manager'])
  await requireManagerOwnership(employeeId, manager.id)

  const employee = await prisma.user.findUnique({ where: { id: employeeId }, select: { full_name: true } })
  if (!employee) notFound()

  const cycle = cycleIdParam
    ? await prisma.cycle.findUnique({ where: { id: cycleIdParam } })
    : await prisma.cycle.findFirst({ where: { status: { not: 'draft' } }, orderBy: { created_at: 'desc' } })

  const goals = cycle
    ? await prisma.goal.findMany({
        where: { cycle_id: cycle.id, employee_id: employeeId },
        orderBy: { created_at: 'asc' },
      })
    : []

  const pending = goals.filter(g => g.status === 'submitted')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{employee.full_name} — Goals</h1>
      {pending.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50/30 px-4 py-2 text-sm text-amber-800 font-medium">
          {pending.length} goal{pending.length !== 1 ? 's' : ''} awaiting approval
        </div>
      )}
      {goals.length === 0 ? (
        <p className="text-muted-foreground">No goals set for this cycle.</p>
      ) : (
        <div className="space-y-2">
          {goals.map(goal => <GoalApprovalRow key={goal.id} goal={goal as unknown as import('@/lib/types').Goal} />)}
        </div>
      )}
    </div>
  )
}
