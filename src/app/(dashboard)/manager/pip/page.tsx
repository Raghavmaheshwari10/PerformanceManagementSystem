import { requireRole } from '@/lib/auth'
import { fetchPipList, fetchPipStats, fetchPipRecommendations } from '@/lib/db/pip'
import { PipDashboard } from '@/components/pip-dashboard'
import { Suspense } from 'react'

export default async function ManagerPipPage() {
  const user = await requireRole(['manager'])

  const [pips, stats, recommendations] = await Promise.all([
    fetchPipList({ managerId: user.id }),
    fetchPipStats({ managerId: user.id }),
    fetchPipRecommendations(),
  ])

  return (
    <Suspense fallback={<div className="animate-pulse space-y-4"><div className="h-8 bg-muted/30 rounded w-48" /><div className="h-64 bg-muted/30 rounded" /></div>}>
      <PipDashboard pips={pips} stats={stats} recommendations={recommendations} role="manager" title="PIP Management" subtitle="Your direct reports" />
    </Suspense>
  )
}
