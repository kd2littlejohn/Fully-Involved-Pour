import type { NewPourInput } from '../../hooks/useUserData'
import { FIP_MAX } from '../fip/scoring'

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export interface QuickPourInputParams {
  bottleId: string
  date: string
  reactionLabel: string
  score: number
  flavors: string[]
}

// Quick Pour skips the component-by-component rubric for speed, so the
// single overall score is spread proportionally across the same weighted
// components (FIP_MAX) the full wizard uses, rather than judged
// independently — the breakdown always sums back to the total exactly, so
// anything that displays "Nose 2.1 / 2.5" elsewhere stays consistent.
export function buildQuickPourInput({ bottleId, date, reactionLabel, score, flavors }: QuickPourInputParams): NewPourInput {
  const total = round1(Math.max(0, Math.min(10, score)))
  const ratio = total / 10
  const nose = round1(FIP_MAX.nose * ratio)
  const palate = round1(FIP_MAX.palate * ratio)
  const finish = round1(FIP_MAX.finish * ratio)
  const complexity = round1(FIP_MAX.complexity * ratio)
  // value absorbs any rounding remainder so the five components always sum
  // exactly to `total`, clamped so it never leaves its own valid range.
  const value = Math.max(0, Math.min(FIP_MAX.value, round1(total - nose - palate - finish - complexity)))

  return {
    bottleId,
    date,
    rating: total,
    mood: reactionLabel,
    fip: {
      nose,
      palate,
      finish,
      complexity,
      value,
      total,
      noseAromas: [],
      palateFlavors: flavors,
    },
  }
}
