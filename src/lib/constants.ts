import type { RatingTier, CycleStatus } from './types'

export const RATING_TIERS: { code: RatingTier; name: string }[] = [
  { code: 'FEE', name: 'Far Exceeds Expectations' },
  { code: 'EE', name: 'Exceeds Expectations' },
  { code: 'ME', name: 'Meets Expectations' },
  { code: 'SME', name: 'Some Meets Expectations' },
  { code: 'BE', name: 'Below Expectations' },
]

// Config map type for UI payout preview (values from payout_config table)
export type PayoutConfigMap = Record<RatingTier, number>

// Default display values (used when payout_config hasn't loaded yet)
export const DEFAULT_PAYOUT_CONFIG: PayoutConfigMap = {
  FEE: 1.25, EE: 1.10, ME: 1.00, SME: 1.00, BE: 0.00,
}

// Updated: accepts explicit config map instead of hardcoded values
export function getPayoutMultiplier(
  rating: RatingTier,
  smeMultiplier: number,
  config: PayoutConfigMap = DEFAULT_PAYOUT_CONFIG
): number {
  if (rating === 'SME') return (config.SME ?? 1.0) + smeMultiplier
  return config[rating] ?? 0
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
