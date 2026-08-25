import type { Bottle, InfinityBatch, InfinityBottle, InfinityTasting } from '../../data/types'

export function currentBatch(ib: InfinityBottle): InfinityBatch | undefined {
  if (ib.archived) return undefined
  return displayBatch(ib)
}

// The batch a screen should actually show — the current one if the vessel
// is active, otherwise its own most recent (now-complete) batch, so an
// archived Infinity Bottle's detail pages still render its last blend
// instead of nothing.
//
// Defensive against `batches` being missing/empty even though every record
// is normalized on load (see migrateInfinityBottle.ts) — a second layer so
// a gap in that normalization never turns into a hard crash here.
export function displayBatch(ib: InfinityBottle): InfinityBatch | undefined {
  const batches = ib.batches ?? []
  return batches.length > 0 ? batches[batches.length - 1] : undefined
}

// "Backdraft Batch - First Due" — the batch is the primary user-facing
// identity; the vessel name only gets appended when the batch itself has
// its own label.
export function batchDisplayName(ib: InfinityBottle, batch: InfinityBatch | undefined): string {
  if (!batch?.name) return ib.name
  return `${ib.name} - ${batch.name}`
}

export function batchVolumeMl(batch: InfinityBatch): number {
  return batch.additions.reduce((sum, a) => sum + a.amountMl, 0)
}

export interface CompositionSlice {
  key: string
  name: string
  ml: number
  percent: number
  // Present only when every addition rolled into this slice still shares
  // the same live sourceBottleId — lets the UI link the slice straight to
  // Bottle Details.
  sourceBottleId?: string
}

// Grouped by bottle identity (canonicalBottleId, falling back to
// sourceBottleId, falling back to the name snapshot) so multiple additions
// of the same bottle over time combine into one slice, sorted largest first.
export function batchComposition(batch: InfinityBatch): CompositionSlice[] {
  const totalMl = batchVolumeMl(batch)
  const byKey = new Map<string, CompositionSlice>()
  for (const addition of batch.additions) {
    const key = addition.canonicalBottleId ?? addition.sourceBottleId ?? addition.bottleName
    const existing = byKey.get(key)
    if (existing) {
      existing.ml += addition.amountMl
      if (existing.sourceBottleId !== addition.sourceBottleId) existing.sourceBottleId = undefined
    } else {
      byKey.set(key, { key, name: addition.bottleName, ml: addition.amountMl, percent: 0, sourceBottleId: addition.sourceBottleId })
    }
  }
  const slices = [...byKey.values()]
  for (const slice of slices) slice.percent = totalMl > 0 ? (slice.ml / totalMl) * 100 : 0
  return slices.sort((a, b) => b.ml - a.ml)
}

// Deliberately all-or-nothing: a weighted average built from only the
// additions that happen to have a proof snapshot would look precise while
// silently ignoring part of the blend. If any volume-contributing addition
// lacks a proof, the estimate is unavailable rather than partial.
export function estimatedProof(batch: InfinityBatch): number | undefined {
  const contributing = batch.additions.filter((a) => a.amountMl > 0)
  if (contributing.length === 0) return undefined
  if (contributing.some((a) => a.proof == null)) return undefined
  const totalMl = contributing.reduce((sum, a) => sum + a.amountMl, 0)
  if (totalMl <= 0) return undefined
  const weighted = contributing.reduce((sum, a) => sum + a.amountMl * (a.proof ?? 0), 0)
  return weighted / totalMl
}

export function sortedTastings(batch: InfinityBatch): InfinityTasting[] {
  return [...batch.tastings].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
}

export function latestTasting(batch: InfinityBatch): InfinityTasting | undefined {
  const sorted = sortedTastings(batch)
  return sorted[sorted.length - 1]
}

export function currentScore(batch: InfinityBatch): number | undefined {
  return latestTasting(batch)?.score
}

export function averageScore(batch: InfinityBatch): number | undefined {
  if (batch.tastings.length === 0) return undefined
  return batch.tastings.reduce((sum, t) => sum + t.score, 0) / batch.tastings.length
}

export interface ScoreEvolutionPoint {
  date: string
  score: number
}

export function scoreEvolution(batch: InfinityBatch): ScoreEvolutionPoint[] {
  return sortedTastings(batch).map((t) => ({ date: t.date, score: t.score }))
}

// Resolves an addition's snapshot back to the live bottle it came from, if
// that bottle still exists in My Bar — used to make composition/timeline
// rows tappable into Bottle Details. Never assumes sourceBottleId is
// still valid (the source bottle may have since been deleted).
export function resolveAdditionSourceBottle(bottles: Bottle[], sourceBottleId: string | undefined): Bottle | undefined {
  if (!sourceBottleId) return undefined
  return bottles.find((b) => b.id === sourceBottleId)
}

export const BLEND_GOAL_LABELS: Record<NonNullable<InfinityBatch['goal']>, string> = {
  sweeter: 'Sweeter',
  'more-oak': 'More Oak',
  'more-spice': 'More Spice',
  'higher-proof': 'Higher Proof',
  smoother: 'Smoother',
  'more-complexity': 'More Complexity',
  experimenting: 'Just Experimenting',
}
