import type { Bottle } from '../../data/types'

// Feeds the AI sommelier a compact digest of the collection so replies can
// reference real bottles instead of generic advice. Capped at 40 bottles to
// keep the prompt small.
export function summarizeCollectionForAi(bottles: Bottle[]): string {
  if (bottles.length === 0) return ''
  return bottles
    .slice(0, 40)
    .map(
      (bottle) =>
        `${bottle.name} (${bottle.distillery ?? 'unknown distillery'}, ${bottle.type ?? 'unknown type'}, ${
          bottle.proof ?? '—'
        } proof, status: ${bottle.status}, rating: ${bottle.rating ?? '—'})`,
    )
    .join('\n')
}
