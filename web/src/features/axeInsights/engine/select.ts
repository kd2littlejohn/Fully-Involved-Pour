import { MAX_CANDIDATES_PER_CATEGORY, SURFACE_COOLDOWN_DAYS } from './config'
import { candidateFingerprint, candidatesFingerprint, inputFingerprints } from './fingerprint'
import { daysBetween, normalizeInput } from './normalize'
import { palateEvolutionCandidates } from './categories/palateEvolution'
import { flavorDiscoveryCandidates } from './categories/flavorDiscovery'
import { bottleRediscoveryCandidates, collectionDiscoveryCandidates } from './categories/collection'
import { blindDiscoveryCandidates, journeyMilestoneCandidates } from './categories/blindAndMilestones'
import { INSIGHT_CATEGORIES, type InsightCandidate, type InsightCategory, type InsightInput } from './types'

export const AXE_INSIGHTS_SCHEMA_VERSION = 1

export interface SurfacedRecord {
  id: string
  bottleIds: string[]
  // Calendar date it was first shown as the selected insight.
  on: string
}

// The cached, per-user insight state (users/{uid}/axeInsights/current).
// Holds summaries and evidence ids, never copies of tasting records.
export interface AxeInsightState {
  schemaVersion: number
  // Bumped on every meaningful change. Lets writers refuse to overwrite a
  // newer result with an older one, and lets clients tell fresh from stale.
  generation: number
  // Opaque marker of the source data this was computed from (the caller
  // passes e.g. the user document's update time).
  sourceRevision: string
  inputFingerprints: Record<InsightCategory, string>
  categories: Record<InsightCategory, { fingerprint: string; candidates: InsightCandidate[] }>
  selected: { candidate: InsightCandidate; fingerprint: string; generation: number } | null
  history: SurfacedRecord[]
  calculatedAt: number
}

export interface ReconcileOptions {
  now: number
  sourceRevision: string
  // The user explicitly asked for a different insight.
  requestNew?: boolean
}

export interface ReconcileResult {
  state: AxeInsightState
  // False when nothing worth saving changed: same inputs, same candidates,
  // same selection. Callers skip the write (and any AI call) then.
  changed: boolean
  recalculated: InsightCategory[]
  changedCategories: InsightCategory[]
}

const HISTORY_LIMIT = 20

export function computeCategoryCandidates(input: InsightInput, categories: readonly InsightCategory[]): Record<InsightCategory, InsightCandidate[]> {
  const normalized = normalizeInput(input)
  const result = {} as Record<InsightCategory, InsightCandidate[]>
  for (const category of categories) {
    let list: InsightCandidate[]
    switch (category) {
      case 'palate-evolution':
        list = palateEvolutionCandidates(normalized)
        break
      case 'flavor-discovery':
        list = flavorDiscoveryCandidates(normalized)
        break
      case 'collection-discovery':
        list = collectionDiscoveryCandidates(normalized)
        break
      case 'bottle-rediscovery':
        list = bottleRediscoveryCandidates(normalized)
        break
      case 'blind-discovery':
        list = blindDiscoveryCandidates(normalized, input.blindTastings)
        break
      case 'journey-milestone':
        list = journeyMilestoneCandidates(normalized, input.blindTastings)
        break
    }
    result[category] = rank(list).slice(0, MAX_CANDIDATES_PER_CATEGORY)
  }
  return result
}

export function rank(candidates: InsightCandidate[]): InsightCandidate[] {
  return [...candidates].sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

function isCoolingDown(candidate: InsightCandidate, history: SurfacedRecord[], today: string, exceptId?: string): boolean {
  return history.some((h) => {
    if (h.id === exceptId) return false
    if (daysBetween(h.on, today) >= SURFACE_COOLDOWN_DAYS) return false
    return h.id === candidate.id || candidate.subjectBottleIds.some((b) => h.bottleIds.includes(b))
  })
}

function emptyCategories(): AxeInsightState['categories'] {
  return Object.fromEntries(INSIGHT_CATEGORIES.map((c) => [c, { fingerprint: '', candidates: [] }])) as unknown as AxeInsightState['categories']
}

// The whole engine step: recalculate only the categories whose inputs
// changed, keep the current insight unless something meaningful happened,
// and report whether there's anything worth saving. Pure and idempotent:
// the same input and previous state always give the same result, and a
// repeat of the same event changes nothing.
export function reconcileInsights(previous: AxeInsightState | null | undefined, input: InsightInput, options: ReconcileOptions): ReconcileResult {
  const prev = previous && previous.schemaVersion === AXE_INSIGHTS_SCHEMA_VERSION ? previous : null
  const today = normalizeInput(input).today
  const fingerprints = inputFingerprints(input)

  const dirty = INSIGHT_CATEGORIES.filter((c) => !prev || prev.inputFingerprints[c] !== fingerprints[c])
  const fresh = computeCategoryCandidates(input, dirty)

  const categories = prev ? { ...prev.categories } : emptyCategories()
  const changedCategories: InsightCategory[] = []
  for (const c of dirty) {
    const fingerprint = candidatesFingerprint(fresh[c])
    if (!prev || prev.categories[c]?.fingerprint !== fingerprint) changedCategories.push(c)
    categories[c] = { fingerprint, candidates: fresh[c] }
  }

  const all = rank(INSIGHT_CATEGORIES.flatMap((c) => categories[c]?.candidates ?? []))
  const history = prev?.history ?? []
  const current = prev?.selected ?? null
  const currentNow = current ? all.find((c) => c.id === current.candidate.id) : undefined
  const previouslyKnown = new Set(prev ? INSIGHT_CATEGORIES.flatMap((c) => prev.categories[c]?.candidates.map((x) => x.id) ?? []) : [])
  const eligible = (c: InsightCandidate) => !isCoolingDown(c, history, today, current?.candidate.id)

  let next: InsightCandidate | undefined
  if (options.requestNew) {
    next = all.find((c) => c.id !== current?.candidate.id && eligible(c)) ?? currentNow
  } else if (currentNow) {
    // Keep what's on screen (with updated numbers if its own data moved),
    // unless a genuinely new insight just appeared that outranks it.
    const newcomer = all.find(
      (c) => !previouslyKnown.has(c.id) && changedCategories.includes(c.category) && c.priority > currentNow.priority && eligible(c),
    )
    next = newcomer ?? currentNow
  } else {
    next = all.find(eligible) ?? all[0]
  }

  let selected: AxeInsightState['selected'] = null
  let nextHistory = history
  const selectionChanged = (next?.id ?? null) !== (current?.candidate.id ?? null)
  const contentChanged = Boolean(next && current && next.id === current.candidate.id && candidateFingerprint(next) !== current.fingerprint)
  const changed = !prev || changedCategories.length > 0 || selectionChanged || contentChanged
  const generation = changed ? (prev?.generation ?? 0) + 1 : prev!.generation

  if (next) {
    const fingerprint = candidateFingerprint(next)
    selected = !selectionChanged && !contentChanged && current ? current : { candidate: next, fingerprint, generation }
    if (selectionChanged) {
      nextHistory = [{ id: next.id, bottleIds: next.subjectBottleIds, on: today }, ...history].slice(0, HISTORY_LIMIT)
    }
  }

  if (!changed) {
    return { state: prev!, changed: false, recalculated: dirty, changedCategories }
  }

  return {
    state: {
      schemaVersion: AXE_INSIGHTS_SCHEMA_VERSION,
      generation,
      sourceRevision: options.sourceRevision,
      inputFingerprints: fingerprints,
      categories,
      selected,
      history: nextHistory,
      calculatedAt: options.now,
    },
    changed: true,
    recalculated: dirty,
    changedCategories,
  }
}
