import { describe, expect, it } from 'vitest'
import { generateTastingSummary } from './summary'
import type { BlindComparison, BlindTastingResponse } from '../../data/types'

function response(overrides: Partial<BlindTastingResponse> = {}): BlindTastingResponse {
  return { pourLabel: 'B', status: 'locked', updatedAt: Date.now(), ...overrides }
}

describe('generateTastingSummary', () => {
  it('states only the opener when nothing supporting was recorded', () => {
    const summary = generateTastingSummary({ bottleName: 'Jefferson’s', response: response(), wins: [] })
    expect(summary).toBe('You chose Jefferson’s before seeing the label.')
  })

  it('adds the liked characteristic when present', () => {
    const summary = generateTastingSummary({
      bottleName: 'Jefferson’s',
      response: response({ likedCharacteristic: 'Sweetness' }),
      wins: [],
    })
    expect(summary).toBe('You chose Jefferson’s before seeing the label. You consistently preferred its sweetness.')
  })

  it('adds comparison-win reasons, deduped, joined naturally', () => {
    const wins: BlindComparison[] = [
      { id: 'A-B', pairLabels: ['A', 'B'], winnerLabel: 'B', reason: 'less-heat', updatedAt: Date.now() },
      { id: 'B-C', pairLabels: ['B', 'C'], winnerLabel: 'B', reason: 'less-heat', updatedAt: Date.now() },
    ]
    const summary = generateTastingSummary({ bottleName: 'Jefferson’s', response: response(), wins })
    expect(summary).toBe('You chose Jefferson’s before seeing the label. You consistently preferred its lower perceived heat.')
  })

  it('combines characteristic and comparison reasons into one natural sentence', () => {
    const wins: BlindComparison[] = [
      { id: 'A-B', pairLabels: ['A', 'B'], winnerLabel: 'B', reason: 'less-heat', updatedAt: Date.now() },
    ]
    const summary = generateTastingSummary({
      bottleName: 'Jefferson’s',
      response: response({ likedCharacteristic: 'Sweetness' }),
      wins,
    })
    expect(summary).toBe(
      'You chose Jefferson’s before seeing the label. You consistently preferred its sweetness, and its lower perceived heat.',
    )
  })

  it('adds a finish mention only for a lingering/building finish, not a short one', () => {
    const lingering = generateTastingSummary({
      bottleName: 'Jefferson’s',
      response: response({ finishLength: 'long' }),
      wins: [],
    })
    expect(lingering).toContain('its finish')

    const short = generateTastingSummary({
      bottleName: 'Jefferson’s',
      response: response({ finishLength: 'short' }),
      wins: [],
    })
    expect(short).toBe('You chose Jefferson’s before seeing the label.')
  })

  it('never fabricates a reason for a win with no recorded reason', () => {
    const wins: BlindComparison[] = [{ id: 'A-B', pairLabels: ['A', 'B'], winnerLabel: 'B', updatedAt: Date.now() }]
    const summary = generateTastingSummary({ bottleName: 'Jefferson’s', response: response(), wins })
    expect(summary).toBe('You chose Jefferson’s before seeing the label.')
  })
})
