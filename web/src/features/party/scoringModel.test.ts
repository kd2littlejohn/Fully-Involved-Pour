import { describe, expect, it } from 'vitest'
import { draftFromBallot, emptySample, enjoymentWord, mergeDrafts, sampleChanged, toServerScore } from './scoringModel'
import type { PartyBallot } from './types'

describe('scoringModel', () => {
  it('only sends detailed sub-scores in Detailed mode, and never an unrated sample', () => {
    const draft = { ...emptySample(), overall: 7, nose: 8, descriptors: ['Vanilla'], notes: ' sweet ' }
    expect(toServerScore(draft, 'quick')).toEqual({ overall: 7, descriptors: ['Vanilla'], notes: 'sweet' })
    expect(toServerScore(draft, 'detailed')).toEqual({ overall: 7, nose: 8, descriptors: ['Vanilla'], notes: 'sweet' })
    expect(toServerScore({ ...emptySample(), nose: 9 }, 'detailed')).toBeNull()
  })

  it('merges unsent local edits over the saved ballot', () => {
    const saved = draftFromBallot(['A', 'B'], { scores: { A: { overall: 5 } }, favoriteLabel: 'A', predictionLabel: null } as unknown as PartyBallot)
    const merged = mergeDrafts(saved, { samples: { B: { ...emptySample(), overall: 9 }, Z: { ...emptySample(), overall: 1 } }, favoriteLabel: null, predictionLabel: null })
    expect(merged.samples.A!.overall).toBe(5)
    expect(merged.samples.B!.overall).toBe(9)
    expect(merged.samples).not.toHaveProperty('Z')
    expect(merged.favoriteLabel).toBe('A')
  })

  it('detects unsaved changes', () => {
    expect(sampleChanged({ ...emptySample(), overall: 6 }, { overall: 6 }, 'quick')).toBe(false)
    expect(sampleChanged({ ...emptySample(), overall: 6.5 }, { overall: 6 }, 'quick')).toBe(true)
    expect(sampleChanged(emptySample(), undefined, 'quick')).toBe(false)
  })

  it('uses friendly words, not jargon', () => {
    expect(enjoymentWord(null)).toBe('Slide to rate')
    expect(enjoymentWord(9.5)).toBe('Outstanding')
    expect(enjoymentWord(0)).toBe('Not my pour')
  })
})
