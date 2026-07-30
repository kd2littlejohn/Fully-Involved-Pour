import { describe, expect, it } from 'vitest'
import { buyAgainToValueScore, computeFipTotal } from './scoring'

describe('computeFipTotal', () => {
  it('sums all five components', () => {
    expect(computeFipTotal({ nose: 2.3, palate: 3.2, finish: 1.8, complexity: 0.9, value: 1 })).toBe(9.2)
  })

  it('rounds to one decimal place', () => {
    // 1.11*3 + 0.11*2 = 3.55 -> rounds to 3.6
    expect(computeFipTotal({ nose: 1.11, palate: 1.11, finish: 1.11, complexity: 0.11, value: 0.11 })).toBe(3.6)
  })

  it('clamps to a maximum of 10', () => {
    expect(computeFipTotal({ nose: 5, palate: 5, finish: 5, complexity: 5, value: 5 })).toBe(10)
  })

  it('clamps to a minimum of 0', () => {
    expect(computeFipTotal({ nose: -5, palate: 0, finish: 0, complexity: 0, value: 0 })).toBe(0)
  })
})

describe('buyAgainToValueScore', () => {
  it('maps each answer to its weighted score', () => {
    expect(buyAgainToValueScore('absolutely')).toBe(1)
    expect(buyAgainToValueScore('probably')).toBe(0.75)
    expect(buyAgainToValueScore('maybe')).toBe(0.5)
    expect(buyAgainToValueScore('probably-not')).toBe(0.25)
    expect(buyAgainToValueScore('no')).toBe(0)
  })

  it('defaults to 0 when no answer was given', () => {
    expect(buyAgainToValueScore(undefined)).toBe(0)
  })
})
