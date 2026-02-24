import { describe, it, expect } from 'vitest'
import { getPayoutMultiplier, RATING_TIERS } from '@/lib/constants'

describe('getPayoutMultiplier', () => {
  it('returns 1.25 for FEE', () => {
    expect(getPayoutMultiplier('FEE', 0.5)).toBe(1.25)
  })

  it('returns 1.10 for EE', () => {
    expect(getPayoutMultiplier('EE', 0.5)).toBe(1.1)
  })

  it('returns 1.00 for ME', () => {
    expect(getPayoutMultiplier('ME', 0.5)).toBe(1.0)
  })

  it('returns cycle sme_multiplier for SME', () => {
    expect(getPayoutMultiplier('SME', 0.75)).toBe(0.75)
  })

  it('returns 0 for BE', () => {
    expect(getPayoutMultiplier('BE', 0.5)).toBe(0)
  })
})

describe('RATING_TIERS', () => {
  it('has 5 tiers', () => {
    expect(RATING_TIERS).toHaveLength(5)
  })
})
