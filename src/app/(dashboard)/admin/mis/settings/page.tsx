import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { MisSettingsForm } from './settings-form'
import type { RatingTier } from '@prisma/client'

const DEFAULT_THRESHOLDS: { tier: RatingTier; min_score: number }[] = [
  { tier: 'FEE', min_score: 110 },
  { tier: 'EE', min_score: 95 },
  { tier: 'ME', min_score: 80 },
  { tier: 'SME', min_score: 60 },
]

export default async function MisSettingsPage() {
  await requireRole(['admin'])

  const [config, scoringConfigs, departments] = await Promise.all([
    prisma.misConfig.findFirst(),
    prisma.scoringConfig.findMany({ orderBy: { min_score: 'desc' } }),
    prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  // Seed default scoring configs if none exist
  if (scoringConfigs.length === 0) {
    for (const { tier, min_score } of DEFAULT_THRESHOLDS) {
      await prisma.scoringConfig.create({ data: { rating_tier: tier, min_score } })
    }
    // Re-fetch after seeding
    const seeded = await prisma.scoringConfig.findMany({ orderBy: { min_score: 'desc' } })
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">MIS Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure MIS integration, scoring thresholds, and department mapping
          </p>
        </div>
        <MisSettingsForm config={config} scoringConfigs={seeded} departments={departments} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">MIS Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure MIS integration, scoring thresholds, and department mapping
        </p>
      </div>
      <MisSettingsForm config={config} scoringConfigs={scoringConfigs} departments={departments} />
    </div>
  )
}
