import type { Distillery, DistillerySeed } from './types'

// Lowercase, accent-stripped, punctuation-collapsed — the single
// normalization rule every match (search, alias resolution, exact lookup)
// goes through, so "Woodford Reserve", "woodford  reserve", and
// "Woodford-Reserve" all compare equal.
export function normalizeDistilleryName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function slugify(value: string): string {
  return normalizeDistilleryName(value).replace(/\s+/g, '-')
}

// Stable ids derived from the name, not hand-typed — the name is very
// unlikely to change once a distillery ships in a seed file, so this stays
// stable in practice while removing an entire category of hand-typo bugs.
// The rare same-slug collision (two distilleries sharing a name) gets a
// numeric suffix so ids never silently collide.
export function buildDistilleries(seeds: DistillerySeed[]): Distillery[] {
  const usedIds = new Set<string>()
  return seeds.map((seed) => {
    const base = slugify(seed.name)
    let id = base
    let suffix = 2
    while (usedIds.has(id)) {
      id = `${base}-${suffix}`
      suffix += 1
    }
    usedIds.add(id)
    return {
      ...seed,
      id,
      normalizedName: normalizeDistilleryName(seed.name),
      aliases: seed.aliases ?? [],
    }
  })
}
