import { requireRole } from '@/lib/auth'
import { fetchPipList, fetchPipStats, fetchPipRecommendations } from '@/lib/db/pip'
import { PipDashboard } from '@/components/pip-dashboard'
import { Suspense } from 'react'

export default async function AdminPipPage() {
  await requireRole(['admin'])

  const [pips, stats, recommendations] = await Promise.all([
    fetchPipList({}),
    fetchPipStats({}),
    fetchPipRecommendations(),
  ])

  return (
    <Suspense fallback={<div className="animate-pulse space-y-4"><div className="h-8 bg-muted/30 rounded w-48" /><div className="h-64 bg-muted/30 rounded" /></div>}>
      <PipDashboard pips={pips} stats={stats} recommendations={recommendations} role="admin" title="PIP Management" subtitle="All departments" />
    </Suspense>
  )
}
