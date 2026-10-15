import type { Party, PartyBallot, PartyCategory } from './types'

export interface MyTastingProgress {
  category: PartyCategory
  scored: number
  total: number
  complete: boolean
}

// Personal progress in the round that's open for voting: how many samples
// this taster has saved an overall score for. Null when nothing is open.
export function myTastingProgress(party: Party, ballots: PartyBallot[]): MyTastingProgress | null {
  const category = party.status === 'completed' ? undefined : party.categories.find((c) => c.state === 'voting_open')
  if (!category) return null
  const ballot = ballots.find((b) => b.categoryId === category.id)
  const total = category.sampleLabels.length
  const scored = category.sampleLabels.filter((label) => ballot?.scores?.[label]).length
  return { category, scored, total, complete: total > 0 && scored === total }
}

export function progressLabel(progress: MyTastingProgress): string {
  if (progress.complete) return 'All samples scored ✓'
  return `${progress.scored} of ${progress.total} ${progress.total === 1 ? 'sample' : 'samples'} scored`
}
