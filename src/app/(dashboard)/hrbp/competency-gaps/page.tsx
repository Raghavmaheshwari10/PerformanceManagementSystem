import { Suspense } from 'react'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchCompetencyGapData, fetchCompetencyGapStats, fetchCompetencyTrends } from '@/lib/db/competency-gaps'
import { CompetencyGapDashboard } from '@/components/competency-gap-dashboard'
import { TableSkeleton } from '@/components/skeletons'

async function CompetencyGapContent() {
  await requireRole(['hrbp'])

  const publishedCycles = await prisma.cycle.findMany({
    where: { status: 'published' },
    orderBy: { published_at: 'desc' },
    take: 10,
    select: { id: true, name: true },
  })

  const latestCycleId = publishedCycles[0]?.id
  if (!latestCycleId) {
    return <CompetencyGapDashboard role="hrbp" rows={[]} stats={{ competencies: [], overallAvg: {}, deptAvg: {}, lowestCompetency: null, lowestDept: null, overallScore: 0 }} trends={[]} cycles={[]} selectedCycleId="" departments={[]} />
  }

  const competencyIds = (await prisma.competency.findMany({ where: { is_active: true }, select: { id: true } })).map(c => c.id)

  const [{ rows }, stats, trends, departments] = await Promise.all([
    fetchCompetencyGapData(latestCycleId),
    fetchCompetencyGapStats(latestCycleId),
    fetchCompetencyTrends(competencyIds),
    prisma.department.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
  ])

  return (
    <CompetencyGapDashboard
      role="hrbp"
      rows={rows}
      stats={stats}
      trends={trends}
      cycles={publishedCycles}
      selectedCycleId={latestCycleId}
      departments={departments.map(d => d.name)}
    />
  )
}

export default function HrbpCompetencyGapsPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <CompetencyGapContent />
    </Suspense>
  )
}
