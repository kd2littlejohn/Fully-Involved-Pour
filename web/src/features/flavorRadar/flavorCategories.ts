import type { Bottle, Pour } from '../../data/types'

// Groups every aroma/flavor tag the app already collects (nose aromas, palate
// flavors, and the legacy per-bottle `flavors` field) into a small set of
// radar axes. No AI call involved — this is a heuristic over data the app
// already has, not a new AI judgment.
export const FLAVOR_AXES = ['Sweet', 'Spicy', 'Woody', 'Fruity', 'Smoky'] as const
export type FlavorAxis = (typeof FLAVOR_AXES)[number]

const TAG_AXIS: Record<string, FlavorAxis> = {
  'Brown Sugar': 'Sweet',
  Vanilla: 'Sweet',
  Caramel: 'Sweet',
  Honey: 'Sweet',
  Toffee: 'Sweet',
  Butterscotch: 'Sweet',
  'Corn Sweetness': 'Sweet',
  Cinnamon: 'Spicy',
  'Baking Spice': 'Spicy',
  'Black Pepper': 'Spicy',
  Oak: 'Woody',
  Cherry: 'Fruity',
  'Orange Peel': 'Fruity',
  'Dark Fruit': 'Fruity',
  Leather: 'Smoky',
  Tobacco: 'Smoky',
}

// Every pour of this bottle plus its legacy `flavors` field, weighted by how
// often each tag comes up — a bottle poured five times with "Oak" every time
// leans woodier on the chart than one where it showed up once.
export function flavorRadarValues(bottle: Bottle, pours: Pour[]): number[] | undefined {
  const tags: string[] = [...(bottle.flavors ?? [])]
  for (const pour of pours) {
    if (pour.bottleId !== bottle.id) continue
    tags.push(...pour.fip.noseAromas, ...pour.fip.palateFlavors)
  }

  const counts: Record<FlavorAxis, number> = { Sweet: 0, Spicy: 0, Woody: 0, Fruity: 0, Smoky: 0 }
  let total = 0
  for (const tag of tags) {
    const axis = TAG_AXIS[tag]
    if (!axis) continue
    counts[axis] += 1
    total += 1
  }

  if (total === 0) return undefined

  const max = Math.max(...FLAVOR_AXES.map((axis) => counts[axis]))
  return FLAVOR_AXES.map((axis) => counts[axis] / max)
}
