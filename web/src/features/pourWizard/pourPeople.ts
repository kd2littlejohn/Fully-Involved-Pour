import type { Pour, PourPerson, PourPersonRef } from '../../data/types'

// trim + lowercase + collapse internal whitespace — "Marcus", " marcus ", and
// "Marcus  " all resolve to the same key, so a typo in spacing/casing never
// creates a duplicate contact.
export function normalizePersonName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function findMatchingPerson(people: PourPerson[], name: string): PourPerson | undefined {
  const key = normalizePersonName(name)
  if (!key) return undefined
  return people.find((p) => p.normalizedName === key)
}

// The pre-this-feature "who was with me" field is a single comma-joined
// string (see Pour.companion) — split it back into individual names so an
// old pour can be displayed/edited through the same PourPersonRef shape as
// a new one, without ever rewriting the original field.
export function parseLegacyCompanion(companion: string | undefined): PourPersonRef[] {
  if (!companion) return []
  return companion
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .map((name) => ({ name }))
}

// The single read path every UI surface should use to get a pour's "Poured
// With" people: prefers the structured field when present, otherwise
// derives it from the legacy `companion` string — and in that legacy case,
// best-effort re-links each parsed name against the user's saved contacts
// by normalized match, so an old pour immediately shows a real avatar if
// one now exists for that name, with no migration or re-save required.
export function resolvePouredWith(pour: Pick<Pour, 'pouredWith' | 'companion'>, people: PourPerson[]): PourPersonRef[] {
  if (pour.pouredWith) {
    // Even structured refs re-resolve against the current people list, in
    // case a ref was created before its person existed yet, or its snapshot
    // name has since drifted from the live record.
    return pour.pouredWith.map((ref) => {
      if (ref.personId) return ref
      const match = findMatchingPerson(people, ref.name)
      return match ? { personId: match.id, name: match.name } : ref
    })
  }
  return parseLegacyCompanion(pour.companion).map((ref) => {
    const match = findMatchingPerson(people, ref.name)
    return match ? { personId: match.id, name: match.name } : ref
  })
}

// Mirrors the new structured field back into the legacy string shape so
// every existing companion-reading selector (getCompanionStats,
// getMostSharedBottle, the "Shared Pour" Bottle Story tag, PourStoryCard,
// PourStoryDetail's "With" row, Journal's companion list) keeps working
// unchanged for pours saved through the new picker.
export function companionStringFromPouredWith(pouredWith: PourPersonRef[]): string | undefined {
  const names = pouredWith.map((ref) => ref.name.trim()).filter((name) => name.length > 0)
  return names.length > 0 ? names.join(', ') : undefined
}
