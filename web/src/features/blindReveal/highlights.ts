import type { BlindFinalRanking, BlindSecretPour, BlindTastingResponse } from '../../data/types'

export interface PourAggregate {
  label: string
  bottleName: string
  avgScore?: number
  avgRank?: number
  scoreCount: number
}

export interface ClosestMatchup {
  a: PourAggregate
  b: PourAggregate
  diff: number
}

export interface MostDivisive {
  pour: PourAggregate
  spread: number
}

export interface Surprise {
  scoreLeader: PourAggregate
  rankLeader: PourAggregate
}

export interface RevealHighlights {
  // Sorted most- to least-preferred by average rank position. Only pours
  // with at least one locked ranking contribute.
  groupRanking: PourAggregate[]
  // Sorted highest to lowest average FIP score. Only pours with at least
  // one locked, scored response contribute.
  groupAverageScores: PourAggregate[]
  // The two pours with the smallest gap in average score — meaningful with
  // just one taster's own scores too, not only in a group.
  closestMatchup?: ClosestMatchup
  // The pour with the widest spread between individual scores — requires
  // at least two people to have scored the same pour, so this is always
  // undefined for a solo session.
  mostDivisive?: MostDivisive
  // Only present when the pour with the highest average score isn't the
  // pour the group (or solo taster) actually ranked first — i.e. only
  // "when supported by the data," never manufactured.
  surprise?: Surprise
}

// Pure aggregation over already-fetched reveal data — no Firestore access,
// no schema changes. Ignores anything not locked, since an in-progress
// draft was never a real, comparable answer.
export function computeRevealHighlights(
  pours: BlindSecretPour[],
  responsesByUid: Record<string, BlindTastingResponse[]>,
  rankingsByUid: Record<string, BlindFinalRanking | undefined>,
): RevealHighlights {
  const byLabel = new Map<string, PourAggregate>()
  const scoresByLabel = new Map<string, number[]>()
  const ranksByLabel = new Map<string, number[]>()

  for (const pour of pours) {
    byLabel.set(pour.label, { label: pour.label, bottleName: pour.bottleName, scoreCount: 0 })
    scoresByLabel.set(pour.label, [])
    ranksByLabel.set(pour.label, [])
  }

  for (const responses of Object.values(responsesByUid)) {
    for (const response of responses) {
      if (response.status !== 'locked' || response.fipScore == null) continue
      scoresByLabel.get(response.pourLabel)?.push(response.fipScore)
    }
  }

  for (const ranking of Object.values(rankingsByUid)) {
    if (!ranking || ranking.status !== 'locked') continue
    ranking.order.forEach((label, index) => {
      ranksByLabel.get(label)?.push(index + 1)
    })
  }

  for (const [label, scores] of scoresByLabel) {
    const agg = byLabel.get(label)
    if (!agg) continue
    agg.scoreCount = scores.length
    if (scores.length > 0) agg.avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length
  }

  for (const [label, ranks] of ranksByLabel) {
    const agg = byLabel.get(label)
    if (!agg || ranks.length === 0) continue
    agg.avgRank = ranks.reduce((sum, r) => sum + r, 0) / ranks.length
  }

  const all = [...byLabel.values()]
  const groupRanking = all.filter((p) => p.avgRank != null).sort((a, b) => a.avgRank! - b.avgRank!)
  const groupAverageScores = all.filter((p) => p.avgScore != null).sort((a, b) => b.avgScore! - a.avgScore!)

  let closestMatchup: ClosestMatchup | undefined
  for (let i = 0; i < groupAverageScores.length; i++) {
    for (let j = i + 1; j < groupAverageScores.length; j++) {
      const a = groupAverageScores[i]!
      const b = groupAverageScores[j]!
      const diff = Math.abs(a.avgScore! - b.avgScore!)
      if (!closestMatchup || diff < closestMatchup.diff) closestMatchup = { a, b, diff }
    }
  }

  let mostDivisive: MostDivisive | undefined
  for (const [label, scores] of scoresByLabel) {
    if (scores.length < 2) continue
    const spread = Math.max(...scores) - Math.min(...scores)
    if (spread <= 0) continue
    if (!mostDivisive || spread > mostDivisive.spread) {
      mostDivisive = { pour: byLabel.get(label)!, spread }
    }
  }

  let surprise: Surprise | undefined
  const scoreLeader = groupAverageScores[0]
  const rankLeader = groupRanking[0]
  if (scoreLeader && rankLeader && scoreLeader.label !== rankLeader.label) {
    surprise = { scoreLeader, rankLeader }
  }

  return { groupRanking, groupAverageScores, closestMatchup, mostDivisive, surprise }
}
