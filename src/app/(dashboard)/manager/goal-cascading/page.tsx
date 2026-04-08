import { Suspense } from 'react'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchGoalTree, fetchGoalCascadingStats } from '@/lib/db/goal-cascading'
import { GoalCascadingDashboard } from '@/components/goal-cascading-dashboard'
import { TableSkeleton } from '@/components/skeletons'

async function GoalCascadingContent() {
  const user = await requireRole(['manager'])

  const publishedCycles = await prisma.cycle.findMany({
    where: { status: 'published' },
    orderBy: { published_at: 'desc' },
    take: 10,
    select: { id: true, name: true },
  })

  const latestCycleId = publishedCycles[0]?.id
  const [tree, stats] = await Promise.all([
    fetchGoalTree({ managerId: user.id, cycleId: latestCycleId }),
    fetchGoalCascadingStats({ managerId: user.id, cycleId: latestCycleId }),
  ])

  const unlinkedKpis = latestCycleId
    ? await prisma.kpi.findMany({
        where: { cycle_id: latestCycleId, manager_id: user.id, dept_goal_id: null },
        select: { id: true, title: true, employee: { select: { full_name: true } } },
      })
    : []

  const availableDeptGoals = latestCycleId
    ? await prisma.deptGoal.findMany({
        where: { org_goal: { cycle_id: latestCycleId } },
        select: { id: true, title: true, department: { select: { name: true } } },
      })
    : []

  return (
    <GoalCascadingDashboard
      role="manager"
      tree={tree}
      stats={stats}
      cycles={publishedCycles}
      departments={[]}
      selectedCycleId={latestCycleId ?? ''}
      unlinkedKpis={unlinkedKpis.map(k => ({
        id: k.id,
        title: k.title,
        employeeName: k.employee.full_name,
      }))}
      availableDeptGoals={availableDeptGoals.map(dg => ({
        id: dg.id,
        title: dg.title,
        department: dg.department.name,
      }))}
    />
  )
}

export default function ManagerGoalCascadingPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <GoalCascadingContent />
    </Suspense>
  )
}
