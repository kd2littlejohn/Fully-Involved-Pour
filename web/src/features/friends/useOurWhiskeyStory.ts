import { useEffect, useState } from 'react'
import { buildOurWhiskeyStory, type OurWhiskeyStory } from './ourWhiskeyStory'

export function useOurWhiskeyStory(viewerUid: string | undefined, friendUid: string | undefined) {
  const [story, setStory] = useState<OurWhiskeyStory | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!viewerUid || !friendUid) {
      setStory(undefined)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    buildOurWhiskeyStory(viewerUid, friendUid)
      .then((result) => {
        if (!cancelled) setStory(result)
      })
      .catch((err) => console.error('useOurWhiskeyStory failed', err))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [viewerUid, friendUid])

  return { story, loading }
}
