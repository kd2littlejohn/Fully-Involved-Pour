// Local, unsaved state for the Create / Edit Party wizard, plus the pure
// operations on it. Nothing here touches Firestore: the wizard builds a
// draft, then hands it to partyAction (createParty / setCategories /
// setSamples) in one go when the host saves.
import type { Party, PartyBottle, PartyFormat, PartySecrets, PartySettings } from './types'
import { DEFAULT_PARTY_SETTINGS, partyFormat } from './types'

export const MAX_CATEGORIES = 24
export const MIN_SAMPLES = 2
export const MAX_SAMPLES = 12
export const SAMPLE_LABELS = 'ABCDEFGHIJKL'.split('')

export interface DraftSample {
  key: string
  label: string
  bottle: PartyBottle
}

export interface DraftCategory {
  key: string
  // Server category id once saved; undefined for a category added in this
  // editing session.
  id?: string
  libraryId: string | null
  name: string
  description: string
  samples: DraftSample[]
  // True once the host has picked letters by hand; otherwise letters are
  // shuffled automatically before saving.
  manualLabels: boolean
  // Voting has opened at least once: bottles and letters are fixed.
  locked: boolean
  // Bottles saved on the server but not loaded here, because the bottle
  // key hasn't been opened in this editing session. Never edited blind.
  hiddenCount: number
  samplesDirty: boolean
}

export interface PartyDraft {
  name: string
  description: string
  eventDate: string
  eventTime: string
  coverImageUrl: string
  capacity: string
  settings: PartySettings
  // "I'm tasting too": the host scores alongside guests. On by default.
  hostTasting: boolean
  format: PartyFormat
  categories: DraftCategory[]
}

let keyCounter = 0
export function draftKey(prefix = 'k'): string {
  keyCounter += 1
  return `${prefix}${Date.now().toString(36)}${keyCounter}`
}

export function emptyDraft(): PartyDraft {
  return {
    name: '',
    description: '',
    eventDate: '',
    eventTime: '',
    coverImageUrl: '',
    capacity: '',
    settings: { ...DEFAULT_PARTY_SETTINGS },
    hostTasting: true,
    format: 'blind',
    categories: [],
  }
}

// Without a bottle key, rounds keep their saved bottles on the server and
// show only how many there are (hiddenCount); see mergeBottleKey.
export function draftFromParty(party: Party, secrets?: Pick<PartySecrets, 'categories'> & Partial<PartySecrets>): PartyDraft {
  const [date, time] = (party.eventDate ?? '').split('T')
  return {
    name: party.name,
    description: party.description ?? '',
    eventDate: date ?? '',
    eventTime: time ?? '',
    coverImageUrl: party.coverImageUrl ?? '',
    capacity: party.capacity ? String(party.capacity) : '',
    settings: { ...DEFAULT_PARTY_SETTINGS, ...party.settings },
    hostTasting: party.hostTasting === true,
    format: partyFormat(party),
    categories: party.categories.map((c) => ({
      key: c.id,
      id: c.id,
      libraryId: c.libraryId,
      name: c.name,
      description: c.description ?? '',
      samples: (secrets?.categories?.[c.id]?.samples ?? []).map((s) => ({ key: s.id, label: s.label, bottle: s.bottle })),
      manualLabels: true,
      locked: Boolean(c.lockedAt),
      hiddenCount: secrets ? 0 : c.sampleLabels.length,
      samplesDirty: false,
    })),
  }
}

export function newDraftCategory(input: { libraryId: string | null; name: string; description: string }): DraftCategory {
  return {
    key: draftKey('c'),
    libraryId: input.libraryId,
    name: input.name,
    description: input.description,
    samples: [],
    manualLabels: false,
    locked: false,
    hiddenCount: 0,
    samplesDirty: true,
  }
}

// Fills in the bottles of rounds that were hidden, once the key is opened,
// without touching anything else already edited in the draft.
export function mergeBottleKey(draft: PartyDraft, secrets: Pick<PartySecrets, 'categories'>): PartyDraft {
  return {
    ...draft,
    categories: draft.categories.map((c) =>
      c.id && c.hiddenCount > 0
        ? { ...c, hiddenCount: 0, samples: (secrets.categories[c.id]?.samples ?? []).map((s) => ({ key: s.id, label: s.label, bottle: s.bottle })) }
        : c,
    ),
  }
}

export function bottleKeyHidden(draft: PartyDraft): boolean {
  return draft.categories.some((c) => c.hiddenCount > 0)
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items
  const copy = [...items]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item!)
  return copy
}

function cryptoRandomInt(max: number): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]! % max
}

export function shuffleLabels(samples: DraftSample[]): DraftSample[] {
  const labels = SAMPLE_LABELS.slice(0, samples.length)
  for (let i = labels.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1)
    ;[labels[i], labels[j]] = [labels[j]!, labels[i]!]
  }
  return samples.map((s, i) => ({ ...s, label: labels[i]! }))
}

// Keeps letters an exact A..N permutation after bottles are added or
// removed, preserving the existing letter order as far as possible.
export function normalizeLabels(samples: DraftSample[]): DraftSample[] {
  const allowed = SAMPLE_LABELS.slice(0, samples.length)
  const used = new Set<string>()
  const kept = samples.map((s) => {
    if (allowed.includes(s.label) && !used.has(s.label)) {
      used.add(s.label)
      return s
    }
    return { ...s, label: '' }
  })
  const free = allowed.filter((l) => !used.has(l))
  return kept.map((s) => (s.label ? s : { ...s, label: free.shift()! }))
}

// Manual pick: give `sampleKey` the letter `label`, swapping with whoever
// had it so every bottle still has exactly one unique letter.
export function assignLabel(samples: DraftSample[], sampleKey: string, label: string): DraftSample[] {
  const target = samples.find((s) => s.key === sampleKey)
  if (!target) return samples
  return samples.map((s) => {
    if (s.key === sampleKey) return { ...s, label }
    if (s.label === label) return { ...s, label: target.label }
    return s
  })
}

export function addSample(category: DraftCategory, bottle: PartyBottle): DraftCategory {
  if (category.locked || category.samples.length >= MAX_SAMPLES) return category
  const samples = normalizeLabels([...category.samples, { key: draftKey('s'), label: '', bottle }])
  return { ...category, samples, samplesDirty: true }
}

export function removeSample(category: DraftCategory, sampleKey: string): DraftCategory {
  if (category.locked) return category
  return { ...category, samples: normalizeLabels(category.samples.filter((s) => s.key !== sampleKey)), samplesDirty: true }
}

export function replaceSample(category: DraftCategory, sampleKey: string, bottle: PartyBottle): DraftCategory {
  if (category.locked) return category
  return { ...category, samples: category.samples.map((s) => (s.key === sampleKey ? { ...s, bottle } : s)), samplesDirty: true }
}

export function moveSample(category: DraftCategory, from: number, to: number): DraftCategory {
  if (category.locked) return category
  return { ...category, samples: moveItem(category.samples, from, to), samplesDirty: true }
}

// A copy for an additional round of the same style: same bottles, fresh
// (reshuffled) letters, never locked.
export function duplicateCategory(category: DraftCategory, existingNames: string[]): DraftCategory {
  let round = 2
  const base = category.name.replace(/ \(Round \d+\)$/, '')
  while (existingNames.includes(`${base} (Round ${round})`)) round += 1
  return {
    ...category,
    key: draftKey('c'),
    id: undefined,
    name: `${base} (Round ${round})`,
    samples: shuffleLabels(category.samples.map((s) => ({ ...s, key: draftKey('s') }))),
    manualLabels: false,
    locked: false,
    // A copy of a round whose bottles are hidden starts without bottles.
    hiddenCount: 0,
    samplesDirty: true,
  }
}

// Letters are randomized for any round the host didn't assign by hand, so
// even the host pouring doesn't know which letter follows which bottle.
export function finalizeLabels(categories: DraftCategory[]): DraftCategory[] {
  return categories.map((c) => (c.locked || c.manualLabels || !c.samplesDirty ? c : { ...c, samples: shuffleLabels(c.samples) }))
}

export interface DraftProblems {
  details: string[]
  categories: string[]
  bottles: string[]
}

export function draftProblems(draft: PartyDraft): DraftProblems {
  const details: string[] = []
  const categories: string[] = []
  const bottles: string[] = []
  if (!draft.name.trim()) details.push('Give your party a name.')
  if (draft.capacity && (!/^\d+$/.test(draft.capacity) || Number(draft.capacity) < 1 || Number(draft.capacity) > 150)) {
    details.push('Guest capacity must be between 1 and 150.')
  }
  if (draft.eventTime && !draft.eventDate) details.push('Add a date for the start time.')
  if (draft.categories.length === 0) categories.push('Pick at least one category.')
  if (draft.categories.length > MAX_CATEGORIES) categories.push(`Up to ${MAX_CATEGORIES} rounds per party.`)
  for (const c of draft.categories) {
    if (!c.name.trim()) categories.push('Every round needs a name.')
    const count = c.samples.length || c.hiddenCount
    if (count > 0 && count < MIN_SAMPLES) bottles.push(`"${c.name}" needs at least ${MIN_SAMPLES} bottles.`)
  }
  return { details, categories, bottles }
}

export function draftEventDate(draft: PartyDraft): string | null {
  if (!draft.eventDate) return null
  return draft.eventTime ? `${draft.eventDate}T${draft.eventTime}` : draft.eventDate
}
