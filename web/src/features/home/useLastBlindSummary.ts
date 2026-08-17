import { useEffect, useState } from 'react'
import { getBlindRoomSecrets, getFinalRanking, getMyBlindRooms, getTastingResponses } from '../../data/repositories/blindRoom'
import type { BlindRoom } from '../../data/types'

export interface LastBlindSummary {
  room: BlindRoom
  winningBottleName: string
  winningDistillery?: string
  winningImageUrl?: string
  score?: number
}

// The user's single most recent finished blind, for Home's Last Blind
// teaser card. Deliberately narrow: only fetches the 3 per-room documents
// (secrets/ranking/responses) needed to name the winner and its score for
// the ONE most recent room, not BlindRevealPage's full multi-participant
// comparison — a homepage teaser doesn't justify that many extra reads (see
// "Avoid unnecessary Firestore reads" in the Home redesign brief). Every
// read here is a pre-existing, already-tested repository function; this
// hook only composes them.
export function useLastBlindSummary(uid: string | undefined): { summary: LastBlindSummary | undefined; loading: boolean } {
  const [summary, setSummary] = useState<LastBlindSummary | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setSummary(undefined)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    async function run() {
      const myRooms = await getMyBlindRooms(uid as string)
      const finished = myRooms
        .filter(({ room }) => room.state === 'revealed' || room.state === 'completed')
        .sort((a, b) => (b.room.completedAt ?? b.room.revealedAt ?? 0) - (a.room.completedAt ?? a.room.revealedAt ?? 0))
      const latest = finished[0]?.room
      if (!latest) return undefined

      const [secrets, ranking, responses] = await Promise.all([
        getBlindRoomSecrets(latest.id),
        getFinalRanking(latest.id, uid as string),
        getTastingResponses(latest.id, uid as string),
      ])

      const winningLabel = ranking?.order[0]
      const winningPour = winningLabel ? secrets?.pours.find((p) => p.label === winningLabel) : undefined
      if (!winningPour) return undefined

      const score = responses.find((r) => r.pourLabel === winningLabel)?.fipScore

      return {
        room: latest,
        winningBottleName: winningPour.bottleName,
        winningDistillery: winningPour.distillery,
        winningImageUrl: winningPour.imageUrl,
        score,
      }
    }

    run()
      .then((result) => {
        if (!cancelled) setSummary(result)
      })
      .catch((err) => console.error('useLastBlindSummary failed', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [uid])

  return { summary, loading }
}
