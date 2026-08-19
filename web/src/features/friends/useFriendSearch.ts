import { useEffect, useState } from 'react'
import { searchProfiles, type ProfileSearchResult } from '../../data/repositories/profile'
import { getFriendStatus, type FriendStatus } from '../../data/repositories/relationships'

export interface FriendSearchResult extends ProfileSearchResult {
  status: FriendStatus
}

const DEBOUNCE_MS = 300

// Debounced search-as-you-type over username/display name (see
// data/repositories/profile.ts searchProfiles — never email). Blocked
// either direction is filtered out entirely rather than shown as an inert
// row, matching "blocked users should not be able to ... send requests."
export function useFriendSearch(viewerUid: string | undefined) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FriendSearchResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!viewerUid || !query.trim()) {
      setResults([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    const timeout = setTimeout(async () => {
      try {
        const found = await searchProfiles(query, viewerUid)
        const withStatus = await Promise.all(found.map(async (p) => ({ ...p, status: await getFriendStatus(viewerUid, p.uid) })))
        if (!cancelled) setResults(withStatus.filter((p) => p.status !== 'blocked' && p.status !== 'blocked_by'))
      } catch (err) {
        console.error('useFriendSearch failed', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [viewerUid, query])

  return { query, setQuery, results, loading }
}
