import type { FriendBottleTake } from '../../data/types'

// "a" / "a and b" / "a, b, and c" — the flowing-sentence join every
// generated summary sentence below uses.
function joinNatural(words: string[]): string {
  if (words.length === 0) return ''
  if (words.length === 1) return words[0] as string
  if (words.length === 2) return `${words[0]} and ${words[1]}`
  return `${words.slice(0, -1).join(', ')}, and ${words[words.length - 1]}`
}

// Phrases FriendBottleTake's real, already-aggregated notes into the 1-2
// sentence summary shown under Friend's Take — never invents a note: every
// word here already came from data/bottleTastingSummary.ts's weighted
// aggregation of the owner's own real Pours. Phrasing lives here, not in
// the stored take, because the owner's own client (which computes and
// writes the take) has no way to know the viewer's relationship framing —
// this only needs the friend's own first name, known once a viewer is
// actually looking at Friend Bottle Quick View.
export function friendTakeSummary(take: FriendBottleTake, friendFirstName: string): string | undefined {
  const notes = take.topNotes ?? []
  if (notes.length === 0) return undefined

  const notesPhrase = joinNatural(notes.map((n) => n.toLowerCase()))
  const finishPhrase =
    take.finishNotes && take.finishNotes.length > 0 ? `, with a ${joinNatural(take.finishNotes.map((f) => f.toLowerCase()))} finish` : ''

  if (take.pourCount <= 1) {
    return `${friendFirstName} found ${notesPhrase}${finishPhrase}.`
  }
  if (take.pourCount <= 3) {
    return `Based on ${take.pourCount} pours, ${friendFirstName} notes ${notesPhrase}${finishPhrase}.`
  }
  return `Based on ${take.pourCount} pours, ${friendFirstName} consistently finds ${notesPhrase}${finishPhrase}.`
}

export interface EvolutionInsight {
  title: string
  detail: string
}

// A generic, honest phrasing of the one real signal
// data/bottleTastingSummary.ts computed (a term's frequency jumping in the
// most recent 3 pours) — deliberately not more specific ("Opening Up",
// "less heat") than the underlying signal actually supports.
export function friendEvolutionInsight(take: FriendBottleTake): EvolutionInsight | undefined {
  if (!take.evolvingTerm) return undefined
  return {
    title: `More ${take.evolvingTerm}`,
    detail: `${take.evolvingTerm} has come up more consistently in the last few pours.`,
  }
}
