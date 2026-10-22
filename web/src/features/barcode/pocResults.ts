// Phase 0 field test results (docs/BARCODE_POC.md → "Testing on your
// iPhone"). One row per bottle, recorded from what the tester confirmed on
// screen, so the ground truth is the label in their hand — not a guess.
// The columns are also what scripts/barcode-poc.js and
// scripts/barcode-poc-summary.js read (expected_* = the confirmed bottle).

import type { BarcodeLookupResult, LabelScanResult } from '../../data/repositories/barcode'
import type { DecodedBarcode, LiveScanStats } from './decoder'
import { DRAFT_FIELDS, type BarcodeOption, type BottleDraft } from './options'

export const RESULT_COLUMNS = [
  'recorded_at',
  'device',
  'gtin13',
  'upc_a',
  'symbology',
  'scan_mode',
  'decoder',
  'ms_to_camera',
  'ms_to_decode',
  'rejected_reads',
  'catalog_status',
  'catalog_ms',
  'verified_options',
  'your_options',
  'axe_used',
  'axe_status',
  'axe_ms',
  'axe_cost_usd',
  'axe_options',
  'label_used',
  'label_status',
  'label_ms',
  'label_cost_usd',
  'label_read_name',
  'label_read_proof',
  'label_read_batch',
  'label_read_barrel',
  'label_read_store_pick',
  'options_shown',
  'picked_from',
  'picked_rank',
  'picked_axe_rank',
  'corrected_fields',
  'added_fields',
  'expected_name',
  'expected_distillery',
  'variant_kind',
  'expected_proof',
  'expected_batch',
  'expected_store_pick',
] as const

export type ResultRow = Record<(typeof RESULT_COLUMNS)[number], string>

export interface ResultInput {
  decoded: DecodedBarcode | null
  scanMode: 'live' | 'photo' | 'typed' | 'label-only'
  stats: LiveScanStats | null
  lookup: BarcodeLookupResult | null
  catalogMs: number | null
  axeUsed: boolean
  axeMs: number | null
  labelScan: LabelScanResult | null
  labelMs: number | null
  options: BarcodeOption[]
  picked: BarcodeOption | null
  initialDraft: BottleDraft
  finalDraft: BottleDraft
  device: string
  now?: Date
}

function s(value: string | number | boolean | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

function changedFields(initial: BottleDraft, final: BottleDraft) {
  const corrected: string[] = []
  const added: string[] = []
  for (const field of DRAFT_FIELDS) {
    const before = initial.values[field].trim()
    const after = final.values[field].trim()
    if (before && after !== before) corrected.push(field)
    else if (!before && after) added.push(field)
  }
  return { corrected, added }
}

export function buildResultRow(input: ResultInput): ResultRow {
  const { decoded, lookup, labelScan, picked, options, finalDraft } = input
  const axe = lookup?.axe
  const label = labelScan?.axe.label
  const axeOptions = options.filter((o) => o.trust === 'axe')
  const { corrected, added } = changedFields(input.initialDraft, finalDraft)
  const v = finalDraft.values
  return {
    recorded_at: (input.now ?? new Date()).toISOString(),
    device: input.device,
    gtin13: s(decoded?.normalized.gtin13),
    upc_a: s(decoded?.normalized.upcA),
    symbology: s(decoded?.normalized.symbology),
    scan_mode: input.scanMode,
    decoder: input.scanMode === 'typed' || input.scanMode === 'label-only' ? '' : s(decoded?.engine),
    ms_to_camera: input.scanMode === 'live' ? s(input.stats?.msToCamera) : '',
    ms_to_decode: input.scanMode === 'live' || input.scanMode === 'photo' ? s(decoded?.msToDecode) : '',
    rejected_reads: input.scanMode === 'live' ? s(input.stats?.rejectedReads) : '',
    catalog_status: s(lookup?.status),
    catalog_ms: s(input.catalogMs),
    verified_options: s(lookup?.verified.length),
    your_options: s(lookup?.yours.length),
    axe_used: input.axeUsed ? 'yes' : 'no',
    axe_status: input.axeUsed ? (axe ? (axe.identified ? 'identified' : 'not-found') : 'error') : '',
    axe_ms: s(input.axeMs),
    axe_cost_usd: input.axeUsed ? s(lookup?.costUsd) : '',
    axe_options: (axe?.identified ? axe.candidates : []).map((c) => `${c.name} [${c.releaseKind}]`).join(' | '),
    label_used: labelScan || input.labelMs !== null ? 'yes' : 'no',
    label_status: labelScan ? (labelScan.axe.identified ? 'identified' : 'not-found') : '',
    label_ms: s(input.labelMs),
    label_cost_usd: s(labelScan?.costUsd),
    label_read_name: s(label?.name),
    label_read_proof: s(label?.proof),
    label_read_batch: s(label?.batch),
    label_read_barrel: s(label?.barrel),
    label_read_store_pick: s(label?.storePick),
    options_shown: s(options.length),
    picked_from: picked ? (picked.trust === 'axe' ? picked.origin : picked.trust) : 'manual',
    picked_rank: picked ? s(options.indexOf(picked) + 1) : '',
    picked_axe_rank: picked?.trust === 'axe' ? s(axeOptions.indexOf(picked) + 1) : '',
    corrected_fields: corrected.join(' '),
    added_fields: added.join(' '),
    expected_name: v.name.trim(),
    expected_distillery: v.distillery.trim(),
    variant_kind: v.releaseKind || 'standard',
    expected_proof: v.proof.trim(),
    expected_batch: (v.batch || v.barrel).trim(),
    expected_store_pick: v.storePick.trim(),
  }
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function resultsToCsv(rows: ResultRow[]): string {
  return [RESULT_COLUMNS.join(','), ...rows.map((row) => RESULT_COLUMNS.map((c) => csvCell(row[c] ?? '')).join(','))].join('\n')
}
