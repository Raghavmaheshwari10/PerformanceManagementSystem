import { describe, it, expect } from 'vitest'
import { getPayoutMultiplier, DEFAULT_PAYOUT_CONFIG, RATING_TIERS } from '@/lib/constants'

describe('getPayoutMultiplier', () => {
  it('returns FEE multiplier from config', () => {
    expect(getPayoutMultiplier('FEE', DEFAULT_PAYOUT_CONFIG)).toBe(1.25)
  })
  it('returns EE multiplier from config', () => {
    expect(getPayoutMultiplier('EE', DEFAULT_PAYOUT_CONFIG)).toBe(1.10)
  })
  it('returns SME multiplier from config', () => {
    expect(getPayoutMultiplier('SME', DEFAULT_PAYOUT_CONFIG)).toBe(1.00)
  })
  it('returns BE = 0', () => {
    expect(getPayoutMultiplier('BE', DEFAULT_PAYOUT_CONFIG)).toBe(0)
  })
  it('uses custom config', () => {
    const custom = { ...DEFAULT_PAYOUT_CONFIG, EE: 1.15 }
    expect(getPayoutMultiplier('EE', custom)).toBe(1.15)
  })
})

describe('RATING_TIERS', () => {
  it('has 5 tiers', () => {
    expect(RATING_TIERS).toHaveLength(5)
  })
})
