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
