import { useEffect, useState } from 'react'
import { getBlindRoomSecrets, getFinalRanking, getMyBlindRooms, getTastingResponses } from '../../data/repositories/blindRoom'
import type { BlindRoom } from '../../data/types'

export interface BlindWinner {
  bottleName: string
  wins: number
}

export interface BlindProfileStats {
  completedCount: number
  averageScore?: number
  mostFrequentWinner?: BlindWinner
  completedRooms: { room: BlindRoom }[]
}

// Same "compose existing repository reads, don't add new Firestore surface
// area" discipline as useLastBlindSummary — every read here is a pre-existing,
// already-tested repository function. Scales with the number of completed
// blinds (3 sub-reads per room), the same shape getBottleBlindHistory
// (data/repositories/blindRoom.ts) already uses for its own per-room loop —
// acceptable for the realistic range of blinds one person completes.
export function useBlindProfileStats(uid: string | undefined): { stats: BlindProfileStats | undefined; loading: boolean } {
  const [stats, setStats] = useState<BlindProfileStats | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setStats(undefined)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    async function run(): Promise<BlindProfileStats> {
      const myRooms = await getMyBlindRooms(uid as string)
      const completedRooms = myRooms.filter(({ room }) => room.state === 'revealed' || room.state === 'completed')

      const scores: number[] = []
      const winnerCounts = new Map<string, BlindWinner>()

      for (const { room } of completedRooms) {
        const [secrets, ranking, responses] = await Promise.all([
          getBlindRoomSecrets(room.id),
          getFinalRanking(room.id, uid as string),
          getTastingResponses(room.id, uid as string),
        ])
        const winningLabel = ranking?.order[0]
        if (!winningLabel) continue
        const winningPour = secrets?.pours.find((p) => p.label === winningLabel)
        if (!winningPour) continue

        const score = responses.find((r) => r.pourLabel === winningLabel)?.fipScore
        if (typeof score === 'number') scores.push(score)

        const entry = winnerCounts.get(winningPour.bottleName) ?? { bottleName: winningPour.bottleName, wins: 0 }
        entry.wins += 1
        winnerCounts.set(winningPour.bottleName, entry)
      }

      const averageScore = scores.length > 0 ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10 : undefined

      // Only surfaced once a bottle has actually won more than once — a
      // single blind's winner isn't a "most frequent" pattern yet.
      let mostFrequentWinner: BlindWinner | undefined
      for (const entry of winnerCounts.values()) {
        if (entry.wins > 1 && (!mostFrequentWinner || entry.wins > mostFrequentWinner.wins)) {
          mostFrequentWinner = entry
        }
      }

      return { completedCount: completedRooms.length, averageScore, mostFrequentWinner, completedRooms }
    }

    run()
      .then((result) => {
        if (!cancelled) setStats(result)
      })
      .catch((err) => console.error('useBlindProfileStats failed', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [uid])

  return { stats, loading }
}
