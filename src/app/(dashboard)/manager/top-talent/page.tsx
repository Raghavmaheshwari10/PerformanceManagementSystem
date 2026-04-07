import { Suspense } from 'react'
import { requireRole } from '@/lib/auth'
import { fetchTopTalentPool, fetchTopTalentStats, fetchTopTalentConfig } from '@/lib/db/top-talent'
import { TopTalentDashboard } from '@/components/top-talent-dashboard'
import { prisma } from '@/lib/prisma'
import { TableSkeleton } from '@/components/skeletons'

async function TopTalentContent() {
  const user = await requireRole(['manager'])
  const config = await fetchTopTalentConfig()

  const publishedCycles = await prisma.cycle.findMany({
    where: { status: 'published' },
    orderBy: { published_at: 'desc' },
    take: 10,
    select: { id: true, name: true },
  })

  const latestCycleId = publishedCycles[0]?.id
  const [pool, stats] = await Promise.all([
    fetchTopTalentPool({ cycleId: latestCycleId, managerId: user.id }),
    fetchTopTalentStats({ cycleId: latestCycleId, managerId: user.id }),
  ])

  return (
    <TopTalentDashboard
      role="manager"
      pool={pool}
      stats={stats}
      config={config}
      cycles={publishedCycles}
      selectedCycleId={latestCycleId ?? ''}
    />
  )
}

export default function ManagerTopTalentPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <TopTalentContent />
    </Suspense>
  )
}
