import type { RatingTier, CycleStatus } from './types'

export const RATING_TIERS: { code: RatingTier; name: string; fixedMultiplier: number | null }[] = [
  { code: 'FEE', name: 'Far Exceeds Expectations', fixedMultiplier: 1.25 },
  { code: 'EE', name: 'Exceeds Expectations', fixedMultiplier: 1.1 },
  { code: 'ME', name: 'Meets Expectations', fixedMultiplier: 1.0 },
  { code: 'SME', name: 'Some Meets Expectations', fixedMultiplier: null },
  { code: 'BE', name: 'Below Expectations', fixedMultiplier: 0 },
]

export function getPayoutMultiplier(rating: RatingTier, smeMultiplier: number): number {
  if (rating === 'SME') return smeMultiplier
  const tier = RATING_TIERS.find(t => t.code === rating)
  return tier?.fixedMultiplier ?? 0
}

export const CYCLE_STATUS_ORDER: CycleStatus[] = [
  'draft', 'kpi_setting', 'self_review', 'manager_review', 'calibrating', 'locked', 'published',
]

export const CYCLE_STATUS_LABELS: Record<CycleStatus, string> = {
  draft: 'Draft',
  kpi_setting: 'KPI Setting',
  self_review: 'Self Review',
  manager_review: 'Manager Review',
  calibrating: 'Calibrating',
  locked: 'Locked',
  published: 'Published',
}
