import { describe, it, expect } from 'vitest'
import { calculateFinalScore, scoreToRatingTier, calculateGoalScore } from '../score-engine'

describe('calculateFinalScore', () => {
  it('applies default weights: goal 50%, competency 20%, manager 20%, peer 10%', () => {
    const result = calculateFinalScore({ goalScore: 80, managerScore: 70, peerScore: 60, competencyScore: 75 })
    // 80*0.50 + 75*0.20 + 70*0.20 + 60*0.10 = 40 + 15 + 14 + 6 = 75
    expect(result).toBeCloseTo(75, 1)
  })

  it('redistributes peer weight to goal when peer score is null', () => {
    // goal 60%, competency 20%, manager 20%
    const result = calculateFinalScore({ goalScore: 100, managerScore: 100, peerScore: null, competencyScore: 100 })
    expect(result).toBeCloseTo(100, 1)
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
