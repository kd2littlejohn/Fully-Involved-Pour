import { describe, expect, it, vi } from 'vitest'

vi.mock('../../data/devMode', () => ({ isMockAuthEnabled: () => true }))

import { castFaceoffVote, faceoffPairKey, getFaceoffTally } from './repository'

describe('faceoffPairKey', () => {
  it('is order-independent and normalizes case/spacing', () => {
    expect(faceoffPairKey('Eagle Rare', "Blanton's Original")).toBe(faceoffPairKey("Blanton's Original", 'Eagle Rare'))
  })
})

describe('faceoff repository (mock mode)', () => {
  it('tallies zero votes for a pair nobody has voted on yet', async () => {
    const tally = await getFaceoffTally('Untouched Bottle A', 'Untouched Bottle B')
    expect(tally).toEqual({ votesForA: 0, votesForB: 0 })
  })

  it('tallies votes cast in mock mode without touching Firestore', async () => {
    await castFaceoffVote('u1', 'Kevin', 'Eagle Rare', 'Blanton\'s Original', 'Eagle Rare')
    await castFaceoffVote('u2', 'Sarah', 'Eagle Rare', 'Blanton\'s Original', 'Eagle Rare')
    await castFaceoffVote('u3', 'Mike', 'Eagle Rare', 'Blanton\'s Original', "Blanton's Original")

    const tally = await getFaceoffTally('Eagle Rare', "Blanton's Original")
    expect(tally).toEqual({ votesForA: 2, votesForB: 1 })
  })
})
