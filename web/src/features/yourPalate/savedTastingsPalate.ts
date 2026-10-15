import type { Bottle, Pour, SavedTasting } from '../../data/types'
import { FIP_MAX } from '../fip/scoring'

// Saved event tastings feed the palate tracker through the shapes it
// already reads (Bottle + Pour), without ever touching My Bar or the pours
// list: these are derived, in-memory only. A tasting linked to a My Bar
// bottle uses that bottle; an unowned one gets a stand-in bottle built from
// its snapshot, shared by every tasting of the same bottle name.
//
// Scores map onto the FIP rubric's own maximums (a 0-10 nose becomes
// 0-2.5, and so on), and the taster's explicit overall enjoyment is the
// rating, exactly as it was given. computeFipTotal is not involved.
export function withSavedTastings(bottles: Bottle[], pours: Pour[], tastings: SavedTasting[] | undefined): { bottles: Bottle[]; pours: Pour[] } {
  if (!tastings?.length) return { bottles, pours }
  const known = new Set(bottles.map((b) => b.id))
  const standIns = new Map<string, Bottle>()
  const derived: Pour[] = []
  const scale = (value: number | undefined, max: number) => (typeof value === 'number' ? Math.round(((value * max) / 10) * 100) / 100 : 0)

  for (const t of tastings) {
    let bottleId = t.bottleId && known.has(t.bottleId) ? t.bottleId : undefined
    if (!bottleId) {
      bottleId = `tasting-bottle:${t.bottle.name.toLowerCase().trim()}`
      if (!standIns.has(bottleId)) {
        standIns.set(bottleId, {
          id: bottleId,
          name: t.bottle.name,
          ...(t.bottle.distillery ? { distillery: t.bottle.distillery } : {}),
          ...(t.bottle.type ? { type: t.bottle.type } : {}),
          ...(typeof t.bottle.proof === 'number' ? { proof: t.bottle.proof } : {}),
          status: 'finished',
        })
      }
    }
    derived.push({
      id: t.id,
      bottleId,
      date: t.date,
      rating: t.overall,
      ...(t.notes ? { notes: t.notes } : {}),
      fip: {
        nose: scale(t.nose, FIP_MAX.nose),
        palate: scale(t.palate, FIP_MAX.palate),
        finish: scale(t.finish, FIP_MAX.finish),
        complexity: scale(t.complexity, FIP_MAX.complexity),
        value: 0,
        total: t.overall,
        noseAromas: [],
        palateFlavors: t.descriptors,
        ...(t.notes ? { palateNotes: t.notes } : {}),
      },
    })
  }
  return { bottles: [...bottles, ...standIns.values()], pours: [...pours, ...derived] }
}
