import { describe, expect, it } from 'vitest'
import { PROOF_OF_GRADUATION } from './eventTemplates'
import { draftProblems, emptyDraft, finalizeLabels } from './setupDraft'

describe('Proof of Graduation template', () => {
  const draft = PROOF_OF_GRADUATION.build(emptyDraft())

  it('sets up the event as specified', () => {
    expect(draft).toMatchObject({
      name: 'Proof of Graduation',
      eventDate: '2026-11-07',
      capacity: '10',
      hostName: 'The Bourbon Daddy',
      presenters: ['Kevin D. Littlejohn', 'Nathaniel D. Rhodes'],
      format: 'dual',
      dual: { joinGroup: 'blind', plannedGuided: 7, plannedBlind: 3 },
    })
    expect(draft.settings.revealByCategory).toBe(false)
    expect(draft.categories.map((c) => c.name)).toEqual(['Flight 1 — Wheated Bourbon', 'Flight 2 — Rye Whiskey', 'Flight 3 — Double Oaked'])
    expect(draft.categories.map((c) => c.samples.map((s) => `${s.label}:${s.bottle.name}`))).toEqual([
      ['A:Castle & Key Wheated', 'B:Weller Antique 107', 'C:Redwood Empire Colonel Armstrong'],
      ['A:E.H. Taylor Straight Rye', 'B:1792 Straight Rye', 'C:Elijah Craig Barrel Proof Rye'],
      ['A:Woodford Reserve Double Oaked', 'B:Barrell Foundation Double Barrel', 'C:Peerless Double Oak'],
    ])
    expect(draftProblems(draft)).toEqual({ details: [], categories: [], bottles: [] })
  })

  it('never guesses a batch-variable proof, and keeps the pour order on save', () => {
    const proofs = Object.fromEntries(draft.categories.flatMap((c) => c.samples.map((s) => [s.bottle.name, s.bottle.proof])))
    expect(proofs['Elijah Craig Barrel Proof Rye']).toBeUndefined()
    expect(proofs['Peerless Double Oak']).toBeUndefined()
    expect(proofs['Weller Antique 107']).toBe(107)
    // Letters were set by hand, so saving doesn't reshuffle them.
    expect(finalizeLabels(draft.categories).map((c) => c.samples.map((s) => s.label).join(''))).toEqual(['ABC', 'ABC', 'ABC'])
    expect(draft.categories.every((c) => c.samples.every((s) => s.bottle.source === 'manual'))).toBe(true)
  })

  it('suggests a pairing for every flight', () => {
    expect(Object.keys(draft.pairings)).toHaveLength(3)
  })
})
