// Canonical distillery reference data — used only to power bottle lookup,
// Add Bottle, custom bottle entry, and Wish List. Deliberately NOT a
// distillery-profile/stats feature: no page, no nav, no analytics reads
// this. Brand names (e.g. Weller, Eagle Rare, Elijah Craig, Russell's
// Reserve) are never distillery records here — those are products bottled
// AT a distillery, not the distillery itself. See seeds/*.ts for the data
// and README.md in this folder for how to update it.

export type DistilleryStatus = 'active' | 'closed' | 'mothballed' | 'demolished'

// What each country seed file authors — deliberately lean. `id` and
// `normalizedName` are never hand-typed here; build.ts derives them from
// `name` so they can never drift out of sync with it (see build.ts).
export interface DistillerySeed {
  name: string
  aliases?: string[]
  city?: string
  stateProvince?: string
  country?: string
  verified: boolean
  parentCompany?: string
  status?: DistilleryStatus
}

// The fully-built record every consumer (search, Add Bottle, etc.) works
// with — always has a stable id, a normalized name, and a real (possibly
// empty) aliases array.
export interface Distillery extends DistillerySeed {
  id: string
  normalizedName: string
  aliases: string[]
}
