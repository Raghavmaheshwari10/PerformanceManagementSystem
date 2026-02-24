import { describe, it, expect } from 'vitest'
import { getNextStatus, canTransition, getTransitionRequirements } from '@/lib/cycle-machine'

describe('canTransition', () => {
  it('allows draft -> kpi_setting', () => {
    expect(canTransition('draft', 'kpi_setting')).toBe(true)
  })

  it('blocks draft -> self_review (must go through kpi_setting)', () => {
    expect(canTransition('draft', 'self_review')).toBe(false)
  })

  it('blocks published -> anything', () => {
    expect(canTransition('published', 'draft')).toBe(false)
  })

  it('allows full forward chain', () => {
    expect(canTransition('kpi_setting', 'self_review')).toBe(true)
    expect(canTransition('self_review', 'manager_review')).toBe(true)
    expect(canTransition('manager_review', 'calibrating')).toBe(true)
    expect(canTransition('calibrating', 'locked')).toBe(true)
    expect(canTransition('locked', 'published')).toBe(true)
  })
})

describe('getNextStatus', () => {
  it('returns kpi_setting for draft', () => {
    expect(getNextStatus('draft')).toBe('kpi_setting')
  })

  it('returns null for published', () => {
    expect(getNextStatus('published')).toBeNull()
  })
})

describe('getTransitionRequirements', () => {
  it('returns role requirement for each transition', () => {
    const req = getTransitionRequirements('draft', 'kpi_setting')
    expect(req).toBeDefined()
    expect(req!.allowedRoles).toContain('admin')
    expect(req!.allowedRoles).toContain('hrbp')
  })

  it('locked -> published only allowed by hrbp', () => {
    const req = getTransitionRequirements('locked', 'published')
    expect(req!.allowedRoles).toEqual(['hrbp'])
  })
})
