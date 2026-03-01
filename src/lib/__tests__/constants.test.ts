import { describe, it, expect } from 'vitest'
import { getPayoutMultiplier, DEFAULT_PAYOUT_CONFIG, RATING_TIERS } from '@/lib/constants'

describe('getPayoutMultiplier', () => {
  it('returns FEE multiplier from config', () => {
    expect(getPayoutMultiplier('FEE', 0, DEFAULT_PAYOUT_CONFIG)).toBe(1.25)
  })
  it('returns EE multiplier from config', () => {
    expect(getPayoutMultiplier('EE', 0, DEFAULT_PAYOUT_CONFIG)).toBe(1.10)
  })
  it('returns SME = SME base + sme bonus', () => {
    expect(getPayoutMultiplier('SME', 0.25, DEFAULT_PAYOUT_CONFIG)).toBe(1.25)
  })
  it('returns BE = 0', () => {
    expect(getPayoutMultiplier('BE', 0, DEFAULT_PAYOUT_CONFIG)).toBe(0)
  })
  it('uses custom config', () => {
    const custom = { ...DEFAULT_PAYOUT_CONFIG, EE: 1.15 }
    expect(getPayoutMultiplier('EE', 0, custom)).toBe(1.15)
  })
})

describe('RATING_TIERS', () => {
  it('has 5 tiers', () => {
    expect(RATING_TIERS).toHaveLength(5)
  })
})
