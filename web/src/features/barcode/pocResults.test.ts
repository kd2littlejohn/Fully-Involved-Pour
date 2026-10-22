import { describe, expect, it } from 'vitest'
import type { BarcodeLookupResult } from '../../data/repositories/barcode'
import { buildOptions, draftFromLabel, draftFromOption, editDraft } from './options'
import { RESULT_COLUMNS, buildResultRow, resultsToCsv } from './pocResults'

const decoded = {
  raw: '036000291452',
  format: 'UPC_A',
  engine: 'zxing' as const,
  normalized: { gtin13: '0036000291452', upcA: '036000291452', symbology: 'UPC_A' as const, restricted: false },
  msToDecode: 540,
}

const lookup: BarcodeLookupResult = {
  gtin13: '0036000291452',
  upcA: '036000291452',
  symbology: 'UPC_A',
  status: 'suggested',
  verified: [],
  yours: [],
  costUsd: 0.061,
  axe: {
    identified: true,
    upcSharedAcrossVariants: true,
    confidence: 'medium',
    sources: [{ url: 'https://example.com/a', title: 'A' }],
    notes: null,
    label: null,
    cached: false,
    candidates: [
      { id: 'axe-1', name: 'Example Bourbon', distillery: 'Example Distillery', brand: null, expression: null, category: 'Bourbon', sizeMl: 750, releaseKind: 'standard', proof: 90, proofVaries: false, ageStatement: null, notes: null },
      { id: 'axe-2', name: 'Example Barrel Proof', distillery: 'Example Distillery', brand: null, expression: null, category: 'Bourbon', sizeMl: 750, releaseKind: 'barrel-proof-batch', proof: null, proofVaries: true, ageStatement: null, notes: null },
    ],
  },
}

describe('buildResultRow', () => {
  const options = buildOptions(lookup, null)
  const picked = options[1]!
  const initialDraft = draftFromOption(picked, null)
  const finalDraft = editDraft(editDraft(editDraft(initialDraft, 'proof', '124.6'), 'batch', 'C924'), 'name', 'Example Bourbon Barrel Proof')

  const row = buildResultRow({
    decoded,
    scanMode: 'live',
    stats: { engine: 'zxing', msToCamera: 230, rejectedReads: 1 },
    lookup,
    catalogMs: 120,
    axeUsed: true,
    axeMs: 6400,
    labelScan: null,
    labelMs: null,
    options,
    picked,
    initialDraft,
    finalDraft,
    device: 'iPhone test',
    now: new Date('2026-10-22T12:00:00Z'),
  })

  it('records what was picked, where it ranked, and what the tester had to fix', () => {
    expect(row).toMatchObject({
      picked_from: 'axe-barcode',
      picked_rank: '2',
      picked_axe_rank: '2',
      options_shown: '2',
      corrected_fields: 'name',
      added_fields: 'proof batch',
    })
  })

  it('takes the ground truth from the confirmed bottle', () => {
    expect(row).toMatchObject({
      expected_name: 'Example Bourbon Barrel Proof',
      expected_distillery: 'Example Distillery',
      variant_kind: 'barrel-proof-batch',
      expected_proof: '124.6',
      expected_batch: 'C924',
    })
  })

  it('records scan timing, AXE latency and cost', () => {
    expect(row).toMatchObject({
      gtin13: '0036000291452',
      scan_mode: 'live',
      decoder: 'zxing',
      ms_to_camera: '230',
      ms_to_decode: '540',
      rejected_reads: '1',
      catalog_ms: '120',
      axe_used: 'yes',
      axe_status: 'identified',
      axe_ms: '6400',
      axe_cost_usd: '0.061',
      axe_options: 'Example Bourbon [standard] | Example Barrel Proof [barrel-proof-batch]',
      label_used: 'no',
    })
  })

  it('records a manual entry with no barcode', () => {
    const draft = editDraft(draftFromLabel(null), 'name', 'Typed Bottle')
    const manual = buildResultRow({
      decoded: null,
      scanMode: 'label-only',
      stats: null,
      lookup: null,
      catalogMs: null,
      axeUsed: false,
      axeMs: null,
      labelScan: null,
      labelMs: null,
      options: [],
      picked: null,
      initialDraft: draftFromLabel(null),
      finalDraft: draft,
      device: 'x',
    })
    expect(manual).toMatchObject({ picked_from: 'manual', picked_rank: '', gtin13: '', added_fields: 'name', axe_used: 'no' })
  })

  it('exports every column, quoting values that need it', () => {
    const csv = resultsToCsv([{ ...row, expected_name: 'Example, "Special"' }])
    const [header, line] = csv.split('\n')
    expect(header).toBe(RESULT_COLUMNS.join(','))
    expect(line).toContain('"Example, ""Special"""')
  })
})
