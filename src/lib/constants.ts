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

// Returns the global payout multiplier for a rating tier
export function getPayoutMultiplier(
  rating: RatingTier,
  config: PayoutConfigMap = DEFAULT_PAYOUT_CONFIG
): number {
  return config[rating] ?? 0
}

export const ROLE_LABELS: Record<string, string> = {
  employee: 'Employee',
  manager: 'Manager',
  hrbp: 'HRBP',
  admin: 'Admin',
}

export const GOAL_TYPE_LABELS: Record<string, string> = {
  business: 'Business',
  development: 'Development',
  behavior: 'Behavior',
}

export const GOAL_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
  closed: 'Closed',
}

export const ANSWER_TYPE_LABELS: Record<string, string> = {
  rating: 'Rating',
  text: 'Text',
  mixed: 'Mixed',
}

export const PEER_REVIEW_STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  accepted: 'Accepted',
  declined: 'Declined',
  submitted: 'Submitted',
}

/** Convert underscore_separated slugs to Title Case */
export function toTitleCase(str: string): string {
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/** Format a KPI value with the correct unit suffix.
 *  Handles data where unit='percent' was incorrectly assigned to number-type KPIs. */
export function formatKpiValue(value: number, unit?: string | null): string {
  if (unit === 'percent' && value <= 200) return `${value}%`
  if (value >= 1000) return value.toLocaleString('en-IN')
  return String(value)
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
