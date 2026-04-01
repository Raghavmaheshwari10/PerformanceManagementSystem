import { describe, it, expect } from 'vitest'
import { calculateFinalScore, scoreToRatingTier, calculateGoalScore } from '../score-engine'

describe('calculateFinalScore', () => {
  it('applies default weights: goal 60%, competency 20%, manager 20%', () => {
    // Default: competencyWeight=20 → goal=0.80*0.75=60%, manager=0.80*0.25=20%, competency=20%
    const result = calculateFinalScore({ goalScore: 80, managerScore: 70, peerScore: null, competencyScore: 75 })
    // 80*0.60 + 75*0.20 + 70*0.20 = 48 + 15 + 14 = 77
    expect(result).toBeCloseTo(77, 1)
  })

  it('uses configurable competency weight', () => {
    // competencyWeight=30 → goal=0.70*0.75=52.5%, manager=0.70*0.25=17.5%, competency=30%
    const result = calculateFinalScore(
      { goalScore: 80, managerScore: 70, peerScore: null, competencyScore: 90 },
      { competencyWeight: 30 }
    )
    // 80*0.525 + 90*0.30 + 70*0.175 = 42 + 27 + 12.25 = 81.25
    expect(result).toBeCloseTo(81.25, 1)
  })

  it('handles zero competency weight (KPI-only cycle)', () => {
    // competencyWeight=0 → goal=1.0*0.75=75%, manager=1.0*0.25=25%
    const result = calculateFinalScore(
      { goalScore: 80, managerScore: 60, peerScore: null, competencyScore: 0 },
      { competencyWeight: 0 }
    )
    // 80*0.75 + 0*0 + 60*0.25 = 60 + 0 + 15 = 75
    expect(result).toBeCloseTo(75, 1)
  })

  it('clamps score to maximum of 100', () => {
    const result = calculateFinalScore({ goalScore: 200, managerScore: 200, peerScore: 200, competencyScore: 200 })
    expect(result).toBe(100)
  })

  it('clamps score to minimum of 0', () => {
    const result = calculateFinalScore({ goalScore: 0, managerScore: 0, peerScore: 0, competencyScore: 0 })
    expect(result).toBe(0)
  })
})

describe('scoreToRatingTier', () => {
  it('maps score >= 90 to FEE (Outstanding)', () => expect(scoreToRatingTier(95)).toBe('FEE'))
  it('maps score >= 70 and < 90 to EE (Exceeds Expectations)', () => expect(scoreToRatingTier(75)).toBe('EE'))
  it('maps score >= 50 and < 70 to ME (Meets Expectations)', () => expect(scoreToRatingTier(55)).toBe('ME'))
  it('maps score >= 30 and < 50 to SME (Below Expectations)', () => expect(scoreToRatingTier(35)).toBe('SME'))
  it('maps score < 30 to BE (Unsatisfactory)', () => expect(scoreToRatingTier(10)).toBe('BE'))
  it('maps exactly 90 to FEE', () => expect(scoreToRatingTier(90)).toBe('FEE'))
  it('maps exactly 70 to EE', () => expect(scoreToRatingTier(70)).toBe('EE'))
})

describe('calculateGoalScore', () => {
  it('returns 0 when no goals', () => {
    expect(calculateGoalScore([])).toBe(0)
  })

  it('returns 0 when no goal has both weight and target', () => {
    expect(calculateGoalScore([{ weight: null, target_value: 100, current_value: 80 }])).toBe(0)
  })

  it('calculates weighted average of goal achievement', () => {
    const goals = [
      { weight: 40, target_value: 100, current_value: 90 },  // 90% achievement
      { weight: 60, target_value: 100, current_value: 70 },  // 70% achievement
    ]
    // (40 * 90 + 60 * 70) / 100 = (3600 + 4200) / 100 = 78
    expect(calculateGoalScore(goals)).toBeCloseTo(78, 1)
  })

  it('caps individual goal achievement at 100%', () => {
    const goals = [{ weight: 100, target_value: 100, current_value: 150 }]
    expect(calculateGoalScore(goals)).toBe(100)
  })
})
