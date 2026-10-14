// The guest's in-progress scores for one round, and the conversions between
// it and the server's ballot shape. One shared state object backs both
// Quick and Detailed scoring, so switching modes never loses anything.
import { FLAVOR_DESCRIPTORS, FLAVOR_FAMILIES } from '../flavorTaxonomy/taxonomy'
import type { PartyBallot, PartySampleScore, PartyScoringMode } from './types'

export interface SampleDraft {
  overall: number | null
  nose: number | null
  palate: number | null
  finish: number | null
  complexity: number | null
  descriptors: string[]
  notes: string
}

export interface RoundDraft {
  samples: Record<string, SampleDraft>
  favoriteLabel: string | null
  predictionLabel: string | null
}

export const DETAILED_FIELDS = [
  { key: 'nose', label: 'Nose', hint: 'What do you smell?' },
  { key: 'palate', label: 'Palate', hint: 'How does it taste?' },
  { key: 'finish', label: 'Finish', hint: 'How long does it linger, and is it pleasant?' },
  { key: 'complexity', label: 'Complexity', hint: 'Layers that keep revealing themselves.' },
] as const

export type DetailedField = (typeof DETAILED_FIELDS)[number]['key']

// Approachable words for Quick Score — no expert vocabulary required. Every
// one is a real FIP flavor descriptor (or plain-English texture word), so
// they line up with tasting notes elsewhere in the app.
export const QUICK_DESCRIPTORS = ['Caramel', 'Vanilla', 'Honey', 'Cherry', 'Baking Spice', 'Cinnamon', 'Oak', 'Chocolate', 'Nutty', 'Smoke', 'Smooth', 'Hot']

export const DETAILED_DESCRIPTOR_GROUPS = FLAVOR_FAMILIES.map((family) => ({
  id: family.id,
  label: family.label,
  descriptors: FLAVOR_DESCRIPTORS.filter((d) => d.family === family.id).map((d) => d.label),
}))

export function emptySample(): SampleDraft {
  return { overall: null, nose: null, palate: null, finish: null, complexity: null, descriptors: [], notes: '' }
}

export function draftFromBallot(labels: string[], ballot: PartyBallot | undefined): RoundDraft {
  const samples: Record<string, SampleDraft> = {}
  for (const label of labels) {
    const s = ballot?.scores?.[label]
    samples[label] = s
      ? {
          overall: s.overall,
          nose: s.nose ?? null,
          palate: s.palate ?? null,
          finish: s.finish ?? null,
          complexity: s.complexity ?? null,
          descriptors: s.descriptors ?? [],
          notes: s.notes ?? '',
        }
      : emptySample()
  }
  return { samples, favoriteLabel: ballot?.favoriteLabel ?? null, predictionLabel: ballot?.predictionLabel ?? null }
}

// Local unsent edits win over the saved ballot for labels the guest has
// touched since; saved values fill in the rest.
export function mergeDrafts(saved: RoundDraft, local: RoundDraft | null): RoundDraft {
  if (!local) return saved
  const samples: Record<string, SampleDraft> = { ...saved.samples }
  for (const [label, draft] of Object.entries(local.samples ?? {})) {
    if (label in samples) samples[label] = { ...emptySample(), ...draft }
  }
  return {
    samples,
    favoriteLabel: local.favoriteLabel ?? saved.favoriteLabel,
    predictionLabel: local.predictionLabel ?? saved.predictionLabel,
  }
}

export function toServerScore(draft: SampleDraft, mode: PartyScoringMode): PartySampleScore | null {
  if (draft.overall === null) return null
  const score: PartySampleScore = { overall: draft.overall }
  if (mode === 'detailed') {
    for (const { key } of DETAILED_FIELDS) {
      const value = draft[key]
      if (value !== null) score[key] = value
    }
  }
  if (draft.descriptors.length) score.descriptors = draft.descriptors
  if (draft.notes.trim()) score.notes = draft.notes.trim()
  return score
}

export function sampleChanged(draft: SampleDraft, saved: PartySampleScore | undefined, mode: PartyScoringMode): boolean {
  const next = toServerScore(draft, mode)
  if (!next) return false
  if (!saved) return true
  return JSON.stringify(next) !== JSON.stringify(normalizeSaved(saved, mode))
}

function normalizeSaved(saved: PartySampleScore, mode: PartyScoringMode): PartySampleScore {
  const out: PartySampleScore = { overall: saved.overall }
  if (mode === 'detailed') for (const { key } of DETAILED_FIELDS) if (saved[key] !== undefined) out[key] = saved[key]
  if (saved.descriptors?.length) out.descriptors = saved.descriptors
  if (saved.notes) out.notes = saved.notes
  return out
}

export function enjoymentWord(value: number | null): string {
  if (value === null) return 'Slide to rate'
  if (value >= 9) return 'Outstanding'
  if (value >= 7.5) return 'Loved it'
  if (value >= 6) return 'Really good'
  if (value >= 4.5) return 'Good'
  if (value >= 3) return 'Just okay'
  if (value >= 1.5) return 'Not for me'
  return 'Not my pour'
}
