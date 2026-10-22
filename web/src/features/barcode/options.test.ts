import { describe, expect, it } from 'vitest'
import type { BarcodeBottle, BarcodeLookupResult, LabelScanResult } from '../../data/repositories/barcode'
import { buildOptions, draftFromLabel, draftFromOption, draftToBottle, editDraft } from './options'

const bottle = (overrides: Partial<BarcodeBottle> = {}): BarcodeBottle => ({
  name: 'Example Bourbon',
  distillery: 'Example Distillery',
  brand: 'Example',
  expression: null,
  category: 'Bourbon',
  sizeMl: 750,
  proof: 90,
  proofVaries: false,
  ageStatement: null,
  releaseKind: 'standard',
  batch: null,
  barrel: null,
  storePick: null,
  releaseYear: null,
  ...overrides,
})

const lookup = (overrides: Partial<BarcodeLookupResult> = {}): BarcodeLookupResult => ({
  gtin13: '0036000291452',
  upcA: '036000291452',
  symbology: 'UPC_A',
  status: 'matched',
  verified: [],
  yours: [],
  ...overrides,
})

const axe = (candidates: { name: string; releaseKind: 'standard' | 'barrel-proof-batch' | 'store-pick'; proof?: number | null }[]) => ({
  identified: true,
  upcSharedAcrossVariants: true,
  confidence: 'medium' as const,
  sources: [],
  notes: null,
  label: null,
  cached: false,
  candidates: candidates.map((c, i) => ({
    id: `axe-${i + 1}`,
    distillery: 'Example Distillery',
    brand: 'Example',
    expression: null,
    category: 'Bourbon',
    sizeMl: 750,
    proof: c.proof ?? null,
    proofVaries: c.releaseKind !== 'standard',
    ageStatement: null,
    notes: null,
    ...c,
  })),
})

describe('buildOptions', () => {
  it('lists verified candidates, then your own entries, then AXE suggestions', () => {
    const options = buildOptions(
      lookup({
        verified: [{ id: 'std', ...bottle() }],
        yours: [{ entryId: 'e1', origin: 'manual', candidateId: null, bottleId: 'b1', submitForReview: false, bottle: bottle({ name: 'Example Store Pick', releaseKind: 'store-pick', storePick: 'Store A' }) }],
        axe: axe([{ name: 'Example Bourbon Barrel Proof', releaseKind: 'barrel-proof-batch' }]),
      }),
      null,
    )
    expect(options.map((o) => [o.trust, o.bottle.name])).toEqual([
      ['verified', 'Example Bourbon'],
      ['yours', 'Example Store Pick'],
      ['axe', 'Example Bourbon Barrel Proof'],
    ])
    expect(options[1]?.bottleId).toBe('b1')
  })

  it('folds your saved copy of a verified candidate into that candidate', () => {
    const options = buildOptions(
      lookup({
        verified: [{ id: 'std', ...bottle() }],
        yours: [{ entryId: 'e1', origin: 'verified', candidateId: 'std', bottleId: 'b7', submitForReview: false, bottle: bottle() }],
      }),
      null,
    )
    expect(options).toHaveLength(1)
    expect(options[0]).toMatchObject({ trust: 'verified', savedByYou: true, bottleId: 'b7' })
  })

  it('drops AXE suggestions that repeat a release already listed, and never gives them batch or barrel', () => {
    const labelScan: LabelScanResult = { gtin13: null, status: 'suggested', axe: axe([{ name: 'Example Bourbon', releaseKind: 'standard', proof: 90 }]) }
    const options = buildOptions(lookup({ verified: [{ id: 'std', ...bottle() }], axe: axe([{ name: 'Example Bourbon', releaseKind: 'standard' }, { name: 'Example Store Pick', releaseKind: 'store-pick' }]) }), labelScan)
    expect(options.map((o) => o.bottle.name)).toEqual(['Example Bourbon', 'Example Store Pick'])
    expect(options[1]).toMatchObject({ trust: 'axe', origin: 'axe-barcode', bottle: { batch: null, barrel: null, storePick: null } })
    expect(options[0]?.sources).toEqual([])
  })

  it('returns nothing when there is no match and no AXE identification', () => {
    expect(buildOptions(lookup({ status: 'no-match' }), null)).toEqual([])
  })
})

describe('drafts', () => {
  const verifiedOption = buildOptions(lookup({ verified: [{ id: 'std', ...bottle() }] }), null)[0]!
  const axeBarrelProof = buildOptions(lookup({ axe: axe([{ name: 'Example Barrel Proof', releaseKind: 'barrel-proof-batch' }]) }), null)[0]!

  it('marks every pre-filled field with where it came from', () => {
    const draft = draftFromOption(verifiedOption, null)
    expect(draft.values).toMatchObject({ name: 'Example Bourbon', proof: '90', sizeMl: '750' })
    expect(draft.sources).toMatchObject({ name: 'verified', proof: 'verified' })
    expect(draft.sources.batch).toBeUndefined()
  })

  it('never pre-fills a proof that varies, but fills it from this bottle’s label', () => {
    expect(draftFromOption(axeBarrelProof, null)).toMatchObject({ values: { proof: '', batch: '' }, proofVaries: true })
    const withLabel = draftFromOption(axeBarrelProof, { name: null, distillery: null, proof: 124.6, batch: 'C924', barrel: null, storePick: null, ageStatement: '12 Years', sizeMl: null })
    expect(withLabel.values).toMatchObject({ proof: '124.6', batch: 'C924', ageStatement: '12 Years' })
    expect(withLabel.sources).toMatchObject({ proof: 'label', batch: 'label', name: 'axe' })
    expect(withLabel.proofVaries).toBe(false)
  })

  it('shows a label reading that disagrees with a verified value instead of overwriting it', () => {
    const draft = draftFromOption(verifiedOption, { name: null, distillery: null, proof: 94, batch: null, barrel: null, storePick: null, ageStatement: null, sizeMl: null })
    expect(draft.values.proof).toBe('90')
    expect(draft.labelConflicts).toEqual({ proof: '94' })
  })

  it('starts manual entry from what the label showed', () => {
    const draft = draftFromLabel({ name: 'Example Pick', distillery: 'Example Distillery', proof: 118, batch: null, barrel: '77', storePick: 'Store A', ageStatement: null, sizeMl: 750 })
    expect(draft.values).toMatchObject({ name: 'Example Pick', barrel: '77', storePick: 'Store A', proof: '118' })
    expect(Object.values(draft.sources).every((s) => s === 'label')).toBe(true)
  })

  it('records the user’s own edits and converts to a bottle', () => {
    const edited = editDraft(draftFromOption(axeBarrelProof, null), 'batch', 'B524')
    expect(edited.sources.batch).toBe('you')
    expect(draftToBottle(editDraft(edited, 'proof', '125.2'))).toMatchObject({
      name: 'Example Barrel Proof',
      batch: 'B524',
      proof: 125.2,
      proofVaries: false,
      releaseKind: 'barrel-proof-batch',
    })
    expect(draftToBottle(edited)).toMatchObject({ proof: null, proofVaries: true })
  })
})
