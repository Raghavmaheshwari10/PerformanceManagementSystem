import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchPipList, fetchPipStats, fetchPipRecommendations } from '@/lib/db/pip'
import { PipDashboard } from '@/components/pip-dashboard'
import { Suspense } from 'react'

export default async function HrbpPipPage() {
  const user = await requireRole(['hrbp'])

  // Get HRBP's assigned department IDs
  const hrbpDepts = await prisma.hrbpDepartment.findMany({
    where: { hrbp_id: user.id },
    select: { department_id: true },
  })
  const deptIds = hrbpDepts.map(d => d.department_id)

  const [pips, stats, recommendations] = await Promise.all([
    fetchPipList({ hrbpDepartmentIds: deptIds }),
    fetchPipStats({ hrbpDepartmentIds: deptIds }),
    fetchPipRecommendations(),
  ])

  return (
    <Suspense fallback={<div className="animate-pulse space-y-4"><div className="h-8 bg-muted/30 rounded w-48" /><div className="h-64 bg-muted/30 rounded" /></div>}>
      <PipDashboard pips={pips} stats={stats} recommendations={recommendations} role="hrbp" title="PIP Management" subtitle="Your departments" />
    </Suspense>
  )
}
