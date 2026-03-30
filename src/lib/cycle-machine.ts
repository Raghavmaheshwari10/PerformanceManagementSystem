import type { CycleStatus, UserRole } from './types'

interface TransitionRule {
  from: CycleStatus
  to: CycleStatus
  allowedRoles: UserRole[]
}

const TRANSITIONS: TransitionRule[] = [
  { from: 'draft', to: 'kpi_setting', allowedRoles: ['admin', 'hrbp'] },
  { from: 'kpi_setting', to: 'self_review', allowedRoles: ['admin', 'hrbp'] },
  { from: 'self_review', to: 'manager_review', allowedRoles: ['admin', 'hrbp'] },
  { from: 'manager_review', to: 'calibrating', allowedRoles: ['admin', 'hrbp'] },
  { from: 'calibrating', to: 'locked', allowedRoles: ['hrbp'] },
  { from: 'locked', to: 'published', allowedRoles: ['hrbp'] },
]

export const STATUS_ORDER: CycleStatus[] = [
  'draft', 'kpi_setting', 'self_review', 'manager_review', 'calibrating', 'locked', 'published',
]

export function canTransition(from: CycleStatus, to: CycleStatus): boolean {
  return TRANSITIONS.some(t => t.from === from && t.to === to)
}

export function getNextStatus(current: CycleStatus): CycleStatus | null {
  const t = TRANSITIONS.find(t => t.from === current)
  return t?.to ?? null
}

export function getTransitionRequirements(from: CycleStatus, to: CycleStatus): TransitionRule | null {
  return TRANSITIONS.find(t => t.from === from && t.to === to) ?? null
}

/** Human-readable label for a transition */
export function getTransitionLabel(from: CycleStatus, to: CycleStatus): string {
  const labels: Record<string, string> = {
    'draft→kpi_setting': 'Start KPI Setting',
    'kpi_setting→self_review': 'Open Self Reviews',
    'self_review→manager_review': 'Open Manager Reviews',
    'manager_review→calibrating': 'Begin Calibration',
    'calibrating→locked': 'Lock Ratings',
    'locked→published': 'Publish Results',
  }
  return labels[`${from}→${to}`] ?? `Move to ${to.replace(/_/g, ' ')}`
}
