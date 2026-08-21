import type { Bottle, SharedBottleSummary } from '../../data/types'

export interface CommonBottle {
  name: string
  distillery?: string
  imageUrl?: string
  type?: string
  proof?: number
  ageStatement?: string
  status: Bottle['status']
}

function key(b: { name: string; distillery?: string }): string {
  return `${b.name.trim().toLowerCase()}|${(b.distillery ?? '').trim().toLowerCase()}`
}

// "Bottles We Both Own" — derived by intersecting the viewer's own bottles
// against the friend's shared-collection projection (see
// data/repositories/sharedCollections.ts). Never reads the friend's
// private users/{uid} doc directly — only what they've already chosen to
// project into sharedCollections/{uid}. Detail fields (type/proof/age/
// status) come from the VIEWER'S OWN copy of the bottle, not the friend's
// projection — no privacy concern there since it's the viewer's own data,
// and it's richer/more current than what the friend last synced.
export function getBottlesInCommon(myBottles: Bottle[], friendBottles: SharedBottleSummary[]): CommonBottle[] {
  const friendByKey = new Map(friendBottles.map((b) => [key(b), b]))
  const seen = new Set<string>()
  const results: CommonBottle[] = []
  for (const bottle of myBottles) {
    if (bottle.status === 'wishlist') continue
    const k = key(bottle)
    if (seen.has(k)) continue
    const match = friendByKey.get(k)
    if (match) {
      seen.add(k)
      results.push({
        name: bottle.name,
        distillery: bottle.distillery,
        imageUrl: bottle.imageUrl || match.imageUrl,
        type: bottle.type,
        proof: bottle.proof,
        ageStatement: bottle.ageStatement,
        status: bottle.status,
      })
    }
  }
  return results
}
