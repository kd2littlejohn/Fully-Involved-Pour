import type { Bottle } from '../../data/types'

// Compact collection digest for Discover's recommendBottles call. (AXE no
// longer uses this — askSommelier builds its context server-side from the
// user's own records, see functions/axeContext.js.) Capped at 40 bottles to
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
