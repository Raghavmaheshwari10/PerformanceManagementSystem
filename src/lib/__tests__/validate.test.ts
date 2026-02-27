import { describe, it, expect } from 'vitest'
import { validateEmail, validateWeight, validateMultiplier } from '../validate'

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true)
    expect(validateEmail('a.b+c@domain.co.uk')).toBe(true)
  })
  it('rejects invalid emails', () => {
    expect(validateEmail('')).toBe(false)
    expect(validateEmail('notanemail')).toBe(false)
    expect(validateEmail('@nodomain')).toBe(false)
    expect(validateEmail('missing@')).toBe(false)
    expect(validateEmail('space @example.com')).toBe(false)
  })
})

describe('validateWeight', () => {
  it('accepts valid weights', () => {
    expect(validateWeight(1)).toBe(true)
    expect(validateWeight(50)).toBe(true)
    expect(validateWeight(100)).toBe(true)
    expect(validateWeight(0.1)).toBe(true)
  })
  it('rejects invalid weights', () => {
    expect(validateWeight(0)).toBe(false)
    expect(validateWeight(-1)).toBe(false)
    expect(validateWeight(101)).toBe(false)
    expect(validateWeight(NaN)).toBe(false)
    expect(validateWeight(Infinity)).toBe(false)
  })
})

describe('validateMultiplier', () => {
  it('accepts valid multipliers', () => {
    expect(validateMultiplier(0)).toBe(true)
    expect(validateMultiplier(1)).toBe(true)
    expect(validateMultiplier(2.5)).toBe(true)
    expect(validateMultiplier(5)).toBe(true)
  })
  it('rejects invalid multipliers', () => {
    expect(validateMultiplier(-0.1)).toBe(false)
    expect(validateMultiplier(5.1)).toBe(false)
    expect(validateMultiplier(NaN)).toBe(false)
    expect(validateMultiplier(Infinity)).toBe(false)
  })
})
