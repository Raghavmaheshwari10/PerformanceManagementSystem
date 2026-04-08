import { Suspense } from 'react'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchGoalTree, fetchGoalCascadingStats } from '@/lib/db/goal-cascading'
import { GoalCascadingDashboard } from '@/components/goal-cascading-dashboard'
import { TableSkeleton } from '@/components/skeletons'

async function GoalCascadingContent() {
  await requireRole(['admin'])

  const [publishedCycles, departments] = await Promise.all([
    prisma.cycle.findMany({
      where: { status: 'published' },
      orderBy: { published_at: 'desc' },
      take: 10,
      select: { id: true, name: true },
    }),
    prisma.department.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const latestCycleId = publishedCycles[0]?.id
  const [tree, stats] = await Promise.all([
    fetchGoalTree({ cycleId: latestCycleId }),
    fetchGoalCascadingStats({ cycleId: latestCycleId }),
  ])

  return (
    <GoalCascadingDashboard
      role="admin"
      tree={tree}
      stats={stats}
      cycles={publishedCycles}
      departments={departments}
      selectedCycleId={latestCycleId ?? ''}
    />
  )
}

export default function AdminGoalCascadingPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <GoalCascadingContent />
    </Suspense>
  )
}
