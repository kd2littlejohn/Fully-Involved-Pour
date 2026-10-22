// Turns a barcode lookup (and an optional front-label scan) into the list
// of bottles the user picks from, and the editable draft for the one they
// pick. One barcode can mean several releases, so this never picks for the
// user; it orders by trust and labels where every value came from.
//
// Trust, highest first:
//   verified — in FIP's catalog, checked by an administrator
//   yours    — something this user saved for this barcode before
//   axe      — an AXE (AI) suggestion; never verified
// Field values additionally carry 'label' (read from the photographed label
// of this bottle — check it) or 'you' (typed by the user).

import type {
  AxeCandidate,
  BarcodeBottle,
  BarcodeLookupResult,
  EntryOrigin,
  LabelReading,
  LabelScanResult,
  ReleaseKind,
} from '../../data/repositories/barcode'

export type OptionTrust = 'verified' | 'yours' | 'axe'
export type FieldSource = OptionTrust | 'label' | 'you'

export const DRAFT_FIELDS = [
  'name',
  'distillery',
  'expression',
  'category',
  'releaseKind',
  'proof',
  'sizeMl',
  'ageStatement',
  'batch',
  'barrel',
  'storePick',
] as const
export type DraftField = (typeof DRAFT_FIELDS)[number]

export interface BottleDraft {
  values: Record<DraftField, string>
  sources: Partial<Record<DraftField, FieldSource>>
  /** Where a label reading disagrees with a verified value — shown, never silently applied. */
  labelConflicts: Partial<Record<DraftField, string>>
  proofVaries: boolean
  brand: string | null
  releaseYear: number | null
}

export interface BarcodeOption {
  key: string
  trust: OptionTrust
  bottle: BarcodeBottle
  candidateId: string | null
  origin: EntryOrigin
  /** The My Bar bottle this user saved it as last time, if any. */
  bottleId: string | null
  /** A verified candidate this user has also saved before. */
  savedByYou: boolean
  notes: string | null
  /** Web sources behind an AXE suggestion — always shown with it (citations). */
  sources: { url: string; title: string | null }[]
}

export const RELEASE_KIND_LABELS: Record<ReleaseKind, string> = {
  standard: 'Standard release',
  'barrel-proof-batch': 'Barrel-proof batch',
  'single-barrel': 'Single barrel',
  'store-pick': 'Store pick',
  'limited-release': 'Limited release',
}

export const TRUST_LABELS: Record<OptionTrust, string> = {
  verified: 'Verified by FIP',
  yours: 'Saved by you',
  axe: 'AXE suggestion · not verified',
}

export const SOURCE_LABELS: Record<FieldSource, string> = {
  verified: 'Verified',
  yours: 'Saved by you',
  axe: 'AXE suggestion',
  label: 'From your label — check it',
  you: 'You',
}

function key(text: string | null | undefined): string {
  return String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function fromAxe(c: AxeCandidate): BarcodeBottle {
  return {
    name: c.name,
    distillery: c.distillery,
    brand: c.brand,
    expression: c.expression,
    category: c.category,
    sizeMl: c.sizeMl,
    proof: c.proof,
    proofVaries: c.proofVaries,
    ageStatement: c.ageStatement,
    releaseKind: c.releaseKind,
    // AXE never supplies these.
    batch: null,
    barrel: null,
    storePick: null,
    releaseYear: null,
  }
}

export function buildOptions(lookup: BarcodeLookupResult | null, labelScan: LabelScanResult | null): BarcodeOption[] {
  const options: BarcodeOption[] = []
  const verifiedIds = new Set<string>()

  for (const c of lookup?.verified ?? []) {
    const { id, ...bottle } = c
    verifiedIds.add(id)
    const saved = lookup?.yours.find((e) => e.candidateId === id)
    options.push({
      key: `verified:${id}`,
      trust: 'verified',
      bottle,
      candidateId: id,
      origin: 'verified',
      bottleId: saved?.bottleId ?? null,
      savedByYou: Boolean(saved),
      notes: null,
      sources: [],
    })
  }
  for (const e of lookup?.yours ?? []) {
    if (e.candidateId && verifiedIds.has(e.candidateId)) continue
    options.push({
      key: `yours:${e.entryId}`,
      trust: 'yours',
      bottle: e.bottle,
      candidateId: e.candidateId,
      origin: e.origin,
      bottleId: e.bottleId,
      savedByYou: true,
      notes: null,
      sources: [],
    })
  }

  // AXE suggestions last; skip any that repeat a release already listed.
  const seen = new Set(options.map((o) => `${key(o.bottle.name)}|${o.bottle.releaseKind ?? ''}`))
  const axeSources: [AxeCandidate[], EntryOrigin, BarcodeOption['sources']][] = [
    [labelScan?.axe.identified ? labelScan.axe.candidates : [], 'axe-label', labelScan?.axe.sources ?? []],
    [lookup?.axe?.identified ? lookup.axe.candidates : [], 'axe-barcode', lookup?.axe?.sources ?? []],
  ]
  for (const [candidates, origin, sources] of axeSources) {
    for (const c of candidates) {
      const k = `${key(c.name)}|${c.releaseKind}`
      if (seen.has(k)) continue
      seen.add(k)
      options.push({
        key: `${origin}:${c.id}:${options.length}`,
        trust: 'axe',
        bottle: fromAxe(c),
        candidateId: null,
        origin,
        bottleId: null,
        savedByYou: false,
        notes: c.notes,
        sources,
      })
    }
  }
  return options
}

function text(value: string | number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

const LABEL_FIELDS: [DraftField, keyof LabelReading][] = [
  ['proof', 'proof'],
  ['batch', 'batch'],
  ['barrel', 'barrel'],
  ['storePick', 'storePick'],
  ['ageStatement', 'ageStatement'],
  ['sizeMl', 'sizeMl'],
]

function emptyDraft(): BottleDraft {
  return {
    values: Object.fromEntries(DRAFT_FIELDS.map((f) => [f, ''])) as Record<DraftField, string>,
    sources: {},
    labelConflicts: {},
    proofVaries: false,
    brand: null,
    releaseYear: null,
  }
}

function applyLabel(draft: BottleDraft, label: LabelReading | null): BottleDraft {
  if (!label) return draft
  for (const [field, labelKey] of LABEL_FIELDS) {
    const read = text(label[labelKey])
    if (!read) continue
    const current = draft.values[field]
    if (!current) {
      draft.values[field] = read
      draft.sources[field] = 'label'
    } else if (key(current) !== key(read)) {
      draft.labelConflicts[field] = read
    }
  }
  // A proof read from this bottle's own label is about this bottle.
  if (draft.sources.proof === 'label') draft.proofVaries = false
  return draft
}

export function draftFromOption(option: BarcodeOption, label: LabelReading | null): BottleDraft {
  const draft = emptyDraft()
  const b = option.bottle
  const values: Record<DraftField, string> = {
    name: b.name,
    distillery: text(b.distillery),
    expression: text(b.expression),
    category: text(b.category),
    releaseKind: text(b.releaseKind),
    // Never pre-fill a proof that varies from bottle to bottle.
    proof: b.proofVaries ? '' : text(b.proof),
    sizeMl: text(b.sizeMl),
    ageStatement: text(b.ageStatement),
    batch: text(b.batch),
    barrel: text(b.barrel),
    storePick: text(b.storePick),
  }
  for (const field of DRAFT_FIELDS) {
    draft.values[field] = values[field]
    if (values[field]) draft.sources[field] = option.trust
  }
  draft.proofVaries = b.proofVaries && !values.proof
  draft.brand = b.brand
  draft.releaseYear = b.releaseYear
  return applyLabel(draft, label)
}

// "None of these" / manual entry: start from whatever the label showed.
export function draftFromLabel(label: LabelReading | null): BottleDraft {
  const draft = emptyDraft()
  if (label?.name) {
    draft.values.name = label.name
    draft.sources.name = 'label'
  }
  if (label?.distillery) {
    draft.values.distillery = label.distillery
    draft.sources.distillery = 'label'
  }
  return applyLabel(draft, label)
}

export function editDraft(draft: BottleDraft, field: DraftField, value: string): BottleDraft {
  const conflicts = { ...draft.labelConflicts }
  delete conflicts[field]
  return {
    ...draft,
    values: { ...draft.values, [field]: value },
    sources: { ...draft.sources, [field]: 'you' },
    labelConflicts: conflicts,
    proofVaries: field === 'proof' && value ? false : draft.proofVaries,
  }
}

function num(value: string): number | null {
  const n = Number(value)
  return value.trim() && Number.isFinite(n) ? n : null
}

function str(value: string): string | null {
  return value.trim() || null
}

export function draftToBottle(draft: BottleDraft): BarcodeBottle {
  const v = draft.values
  const releaseKind = (Object.keys(RELEASE_KIND_LABELS) as ReleaseKind[]).includes(v.releaseKind as ReleaseKind)
    ? (v.releaseKind as ReleaseKind)
    : null
  return {
    name: v.name.trim(),
    distillery: str(v.distillery),
    brand: draft.brand,
    expression: str(v.expression),
    category: str(v.category),
    sizeMl: num(v.sizeMl),
    proof: num(v.proof),
    proofVaries: draft.proofVaries && !num(v.proof),
    ageStatement: str(v.ageStatement),
    releaseKind,
    batch: str(v.batch),
    barrel: str(v.barrel),
    storePick: str(v.storePick),
    releaseYear: draft.releaseYear,
  }
}
