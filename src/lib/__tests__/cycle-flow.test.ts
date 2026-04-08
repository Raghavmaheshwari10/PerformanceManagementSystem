import { describe, it, expect } from 'vitest'
import {
  canTransition,
  canRevert,
  getNextStatus,
  getPreviousStatus,
  getTransitionRequirements,
  getRevertRequirements,
  getTransitionLabel,
  STATUS_ORDER,
} from '@/lib/cycle-machine'
import type { CycleStatus, UserRole } from '@/lib/types'

// ---------------------------------------------------------------------------
// Suite 1: Full cycle forward flow
// ---------------------------------------------------------------------------

describe('Full cycle forward flow', () => {
  const forwardPairs: [CycleStatus, CycleStatus][] = [
    ['draft', 'kpi_setting'],
    ['kpi_setting', 'self_review'],
    ['self_review', 'manager_review'],
    ['manager_review', 'calibrating'],
    ['calibrating', 'locked'],
    ['locked', 'published'],
  ]

  it.each(forwardPairs)(
    'canTransition(%s, %s) is true',
    (from, to) => {
      expect(canTransition(from, to)).toBe(true)
    },
  )

  it.each(forwardPairs)(
    'getTransitionRequirements(%s, %s) returns allowed roles',
    (from, to) => {
      const req = getTransitionRequirements(from, to)
      expect(req).not.toBeNull()
      expect(req!.allowedRoles.length).toBeGreaterThan(0)
    },
  )

  it('getNextStatus returns the correct next state for every status', () => {
    expect(getNextStatus('draft')).toBe('kpi_setting')
    expect(getNextStatus('kpi_setting')).toBe('self_review')
    expect(getNextStatus('self_review')).toBe('manager_review')
    expect(getNextStatus('manager_review')).toBe('calibrating')
    expect(getNextStatus('calibrating')).toBe('locked')
    expect(getNextStatus('locked')).toBe('published')
    expect(getNextStatus('published')).toBeNull()
  })

  it('getTransitionLabel returns a human-readable label for each forward transition', () => {
    for (const [from, to] of forwardPairs) {
      const label = getTransitionLabel(from, to)
      expect(label).toBeTruthy()
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Suite 2: Cycle transition role enforcement
// ---------------------------------------------------------------------------

describe('Cycle transition role enforcement', () => {
  function rolesFor(from: CycleStatus, to: CycleStatus): UserRole[] {
    return getTransitionRequirements(from, to)?.allowedRoles ?? []
  }

  describe('draft -> kpi_setting', () => {
    it('admin can perform', () => {
      expect(rolesFor('draft', 'kpi_setting')).toContain('admin')
    })
    it('hrbp can perform', () => {
      expect(rolesFor('draft', 'kpi_setting')).toContain('hrbp')
    })
    it('manager cannot perform', () => {
      expect(rolesFor('draft', 'kpi_setting')).not.toContain('manager')
    })
    it('employee cannot perform', () => {
      expect(rolesFor('draft', 'kpi_setting')).not.toContain('employee')
    })
  })

  describe('kpi_setting -> self_review', () => {
    it('admin can perform', () => {
      expect(rolesFor('kpi_setting', 'self_review')).toContain('admin')
    })
    it('hrbp can perform', () => {
      expect(rolesFor('kpi_setting', 'self_review')).toContain('hrbp')
    })
    it('manager cannot perform', () => {
      expect(rolesFor('kpi_setting', 'self_review')).not.toContain('manager')
    })
    it('employee cannot perform', () => {
      expect(rolesFor('kpi_setting', 'self_review')).not.toContain('employee')
    })
  })

  describe('self_review -> manager_review', () => {
    it('admin can perform', () => {
      expect(rolesFor('self_review', 'manager_review')).toContain('admin')
    })
    it('hrbp can perform', () => {
      expect(rolesFor('self_review', 'manager_review')).toContain('hrbp')
    })
  })

  describe('manager_review -> calibrating', () => {
    it('admin can perform', () => {
      expect(rolesFor('manager_review', 'calibrating')).toContain('admin')
    })
    it('hrbp can perform', () => {
      expect(rolesFor('manager_review', 'calibrating')).toContain('hrbp')
    })
  })

  describe('calibrating -> locked', () => {
    it('hrbp can perform', () => {
      expect(rolesFor('calibrating', 'locked')).toContain('hrbp')
    })
    it('admin cannot perform', () => {
      expect(rolesFor('calibrating', 'locked')).not.toContain('admin')
    })
    it('manager cannot perform', () => {
      expect(rolesFor('calibrating', 'locked')).not.toContain('manager')
    })
    it('employee cannot perform', () => {
      expect(rolesFor('calibrating', 'locked')).not.toContain('employee')
    })
  })

  describe('locked -> published', () => {
    it('hrbp can perform', () => {
      expect(rolesFor('locked', 'published')).toContain('hrbp')
    })
    it('admin cannot perform', () => {
      expect(rolesFor('locked', 'published')).not.toContain('admin')
    })
  })
})

// ---------------------------------------------------------------------------
// Suite 3: Cycle revert transitions
// ---------------------------------------------------------------------------

describe('Cycle revert transitions', () => {
  const revertableStatuses: CycleStatus[] = [
    'kpi_setting',
    'self_review',
    'manager_review',
    'calibrating',
    'locked',
  ]

  it.each(revertableStatuses)(
    '%s can be reverted to its previous state',
    (status) => {
      expect(canRevert(status)).toBe(true)
    },
  )

  it('published cannot be reverted', () => {
    expect(canRevert('published')).toBe(false)
  })

  it('draft has no previous state', () => {
    expect(getPreviousStatus('draft')).toBeNull()
    expect(canRevert('draft')).toBe(false)
  })

  it('revert is admin-only for all revert transitions', () => {
    for (const status of revertableStatuses) {
      const req = getRevertRequirements(status)
      expect(req).not.toBeNull()
      expect(req!.allowedRoles).toEqual(['admin'])
    }
  })

  it('getPreviousStatus returns the correct previous state', () => {
    expect(getPreviousStatus('kpi_setting')).toBe('draft')
    expect(getPreviousStatus('self_review')).toBe('kpi_setting')
    expect(getPreviousStatus('manager_review')).toBe('self_review')
    expect(getPreviousStatus('calibrating')).toBe('manager_review')
    expect(getPreviousStatus('locked')).toBe('calibrating')
    expect(getPreviousStatus('published')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Suite 4: Invalid transitions
// ---------------------------------------------------------------------------

describe('Invalid transitions', () => {
  it('cannot skip states (draft -> self_review)', () => {
    expect(canTransition('draft', 'self_review')).toBe(false)
  })

  it('cannot skip states (draft -> manager_review)', () => {
    expect(canTransition('draft', 'manager_review')).toBe(false)
  })

  it('cannot skip states (draft -> calibrating)', () => {
    expect(canTransition('draft', 'calibrating')).toBe(false)
  })

  it('cannot skip states (kpi_setting -> manager_review)', () => {
    expect(canTransition('kpi_setting', 'manager_review')).toBe(false)
  })

  it('cannot skip states (self_review -> locked)', () => {
    expect(canTransition('self_review', 'locked')).toBe(false)
  })

  it('cannot go backward via forward transition (self_review -> draft)', () => {
    expect(canTransition('self_review', 'draft')).toBe(false)
  })

  it('cannot go backward via forward transition (manager_review -> kpi_setting)', () => {
    expect(canTransition('manager_review', 'kpi_setting')).toBe(false)
  })

  it('cannot go backward via forward transition (published -> locked)', () => {
    expect(canTransition('published', 'locked')).toBe(false)
  })

  it('published is terminal — no forward transition from published', () => {
    expect(getNextStatus('published')).toBeNull()
    for (const status of STATUS_ORDER) {
      expect(canTransition('published', status)).toBe(false)
    }
  })

  it('every invalid combination returns false', () => {
    // Build set of valid forward transitions for fast lookup
    const validPairs = new Set<string>()
    for (let i = 0; i < STATUS_ORDER.length - 1; i++) {
      validPairs.add(`${STATUS_ORDER[i]}→${STATUS_ORDER[i + 1]}`)
    }

    for (const from of STATUS_ORDER) {
      for (const to of STATUS_ORDER) {
        const key = `${from}→${to}`
        if (!validPairs.has(key)) {
          expect(canTransition(from, to)).toBe(false)
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Suite 5: Status order integrity
// ---------------------------------------------------------------------------

describe('Status order integrity', () => {
  it('STATUS_ORDER has exactly 7 entries', () => {
    expect(STATUS_ORDER).toHaveLength(7)
  })

  it('STATUS_ORDER starts with draft', () => {
    expect(STATUS_ORDER[0]).toBe('draft')
  })

  it('STATUS_ORDER ends with published', () => {
    expect(STATUS_ORDER[STATUS_ORDER.length - 1]).toBe('published')
  })

  it('each adjacent pair in STATUS_ORDER has a valid forward transition', () => {
    for (let i = 0; i < STATUS_ORDER.length - 1; i++) {
      const from = STATUS_ORDER[i]
      const to = STATUS_ORDER[i + 1]
      expect(canTransition(from, to)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Suite 6: Transition labels
// ---------------------------------------------------------------------------

describe('Transition labels', () => {
  const forwardPairs: [CycleStatus, CycleStatus][] = [
    ['draft', 'kpi_setting'],
    ['kpi_setting', 'self_review'],
    ['self_review', 'manager_review'],
    ['manager_review', 'calibrating'],
    ['calibrating', 'locked'],
    ['locked', 'published'],
  ]

  it.each(forwardPairs)(
    'transition %s -> %s has a human-readable label',
    (from, to) => {
      const label = getTransitionLabel(from, to)
      expect(label).toBeTruthy()
      expect(label.length).toBeGreaterThan(0)
    },
  )

  it.each(forwardPairs)(
    'label for %s -> %s does not contain underscores',
    (from, to) => {
      const label = getTransitionLabel(from, to)
      expect(label).not.toContain('_')
    },
  )
})
