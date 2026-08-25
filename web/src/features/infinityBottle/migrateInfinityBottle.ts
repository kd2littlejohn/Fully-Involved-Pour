import type { BlendAddition, InfinityBatch, InfinityBottle, InfinityTasting } from '../../data/types'

// The pre-batch shape this app used to write (see InfinityBottleButton.tsx
// before the vessel/batch rewrite). `amount` was a free-text field with no
// guaranteed unit (placeholder was literally "1 oz") — never a number.
interface LegacyInfinityBottleAddition {
  bottleId?: string
  name?: string
  amount?: string
  date?: string
}

interface LegacyInfinityBottleShape {
  id?: string
  name?: string
  notes?: string
  additions?: LegacyInfinityBottleAddition[]
}

const ML_PER_OZ = 29.5735

function generateMigrationId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

// Only converts amount text that unambiguously parses as a number plus a
// known unit (matching the ml/oz toggle Add to Blend already uses) — never
// guesses at vaguer text like "a splash" or "the rest of the bottle". The
// original text is preserved as a note either way so nothing is silently
// dropped, per "do not fabricate bottle facts."
function parseLegacyAmount(raw: string | undefined): { amountMl: number; unparsedNote?: string } {
  const trimmed = raw?.trim()
  if (!trimmed) return { amountMl: 0 }
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(ml|oz)?$/i)
  if (!match) return { amountMl: 0, unparsedNote: `Legacy amount: ${trimmed}` }
  const value = Number(match[1])
  const unit = (match[2] ?? 'ml').toLowerCase()
  return { amountMl: Math.round(unit === 'oz' ? value * ML_PER_OZ : value) }
}

function migrateLegacyAddition(raw: LegacyInfinityBottleAddition, index: number, fallbackDate: string): BlendAddition {
  const { amountMl, unparsedNote } = parseLegacyAmount(raw.amount)
  return {
    id: generateMigrationId(`legacy-addition-${index}`),
    sourceBottleId: raw.bottleId,
    bottleName: raw.name?.trim() || 'Unknown Bottle',
    amountMl,
    date: raw.date ?? fallbackDate,
    note: unparsedNote,
    createdAt: Date.now(),
  }
}

function normalizeAddition(raw: unknown): BlendAddition {
  const r = (raw ?? {}) as Partial<BlendAddition>
  return {
    id: r.id ?? generateMigrationId('addition'),
    sourceBottleId: r.sourceBottleId,
    canonicalBottleId: r.canonicalBottleId,
    bottleName: r.bottleName ?? 'Unknown Bottle',
    proof: r.proof,
    amountMl: typeof r.amountMl === 'number' ? r.amountMl : 0,
    date: r.date ?? new Date(0).toISOString().slice(0, 10),
    note: r.note,
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
  }
}

function normalizeTasting(raw: unknown): InfinityTasting {
  const r = (raw ?? {}) as Partial<InfinityTasting>
  return {
    id: r.id ?? generateMigrationId('tasting'),
    date: r.date ?? new Date(0).toISOString().slice(0, 10),
    score: typeof r.score === 'number' ? r.score : 0,
    noseAromas: Array.isArray(r.noseAromas) ? r.noseAromas : [],
    noseNotes: r.noseNotes,
    palateFlavors: Array.isArray(r.palateFlavors) ? r.palateFlavors : [],
    palateNotes: r.palateNotes,
    finishNotes: r.finishNotes,
    overallNotes: r.overallNotes,
    photoUrl: r.photoUrl,
    photoStoragePath: r.photoStoragePath,
    companion: r.companion,
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
  }
}

function normalizeBatch(raw: unknown): InfinityBatch {
  const r = (raw ?? {}) as Partial<InfinityBatch>
  return {
    id: r.id ?? generateMigrationId('batch'),
    name: r.name,
    goal: r.goal,
    status: r.status === 'complete' ? 'complete' : 'active',
    startedAt: typeof r.startedAt === 'number' ? r.startedAt : Date.now(),
    completedAt: r.completedAt,
    additions: Array.isArray(r.additions) ? r.additions.map(normalizeAddition) : [],
    tastings: Array.isArray(r.tastings) ? r.tastings.map(normalizeTasting) : [],
  }
}

export interface NormalizeResult {
  bottle: InfinityBottle
  // True only when the raw record needed a real one-time migration (no
  // valid `batches` array at all) — never true for an already-batches-
  // shaped record that merely had a sparse optional field filled in
  // in-memory. Callers use this to decide whether a Firestore write-back
  // is actually needed.
  migrated: boolean
}

// Single choke point every Infinity Bottle record passes through before
// any selector or page ever sees it — guarantees `batches` is always a
// real array, so `ib.batches.length` can never crash again regardless of
// what shape is actually sitting in Firestore/localStorage.
export function normalizeInfinityBottle(raw: unknown): NormalizeResult {
  const r = (raw ?? {}) as Partial<InfinityBottle> & LegacyInfinityBottleShape
  const id = r.id ?? generateMigrationId('legacy-ib')
  const name = r.name?.trim() || 'Infinity Bottle'
  const createdAt = typeof r.createdAt === 'number' ? r.createdAt : Date.now()
  const archived = typeof r.archived === 'boolean' ? r.archived : false
  const shared = { id, name, photoUrl: r.photoUrl, photoStoragePath: r.photoStoragePath, capacityMl: r.capacityMl, archived, createdAt }

  if (Array.isArray(r.batches)) {
    const batches = r.batches.length > 0 ? r.batches.map(normalizeBatch) : [normalizeBatch(undefined)]
    return { bottle: { ...shared, batches }, migrated: false }
  }

  // Legacy shape: a flat additions[] array and no batches at all — convert
  // every old addition into a single initial active batch, preserving the
  // vessel's id/name and every addition's source bottle, amount, date, and
  // note. Legacy records never had a proof snapshot, so proof stays
  // undefined (never fabricated) rather than guessed at.
  const legacyAdditions = Array.isArray(r.additions) ? r.additions : []
  const fallbackDate = new Date(createdAt).toISOString().slice(0, 10)
  const batch: InfinityBatch = {
    id: generateMigrationId('legacy-batch'),
    name: 'Batch 1',
    status: 'active',
    startedAt: createdAt,
    additions: legacyAdditions.map((a, i) => migrateLegacyAddition(a, i, fallbackDate)),
    tastings: [],
  }
  return { bottle: { ...shared, batches: [batch] }, migrated: true }
}

export interface NormalizeListResult {
  infinityBottles: InfinityBottle[]
  migrated: boolean
}

export function normalizeInfinityBottles(list: unknown): NormalizeListResult {
  const source = Array.isArray(list) ? list : []
  let migrated = false
  const infinityBottles = source.map((raw) => {
    const result = normalizeInfinityBottle(raw)
    if (result.migrated) migrated = true
    return result.bottle
  })
  return { infinityBottles, migrated }
}
