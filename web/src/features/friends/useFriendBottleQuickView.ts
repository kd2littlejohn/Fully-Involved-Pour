import { useEffect, useState } from 'react'
import { fetchProfile } from '../../data/repositories/profile'
import { getSharedMomentsForOwner } from '../../data/repositories/sharedMoments'
import { getSharedCollection } from '../../data/repositories/sharedCollections'
import type { Profile, SharedBottleSummary, SharedMoment } from '../../data/types'

export interface FriendBottleQuickViewData {
  friendProfile: Profile | undefined
  // The friend's own privacy-filtered projection of this exact bottle
  // (facts + take, if their pourStoryDefault allows it) — a fallback for
  // whichever fields the tap site didn't already have in hand. Some entry
  // points (Recent Friend Activity, a Recommendation) only know the bottle
  // name; this backfills the rest from the same real, owner-computed
  // projection Bottles We Both Own already reads.
  bottleFacts: SharedBottleSummary | undefined
  // Only pours of THIS bottle the friend has explicitly tagged the viewer
  // in — same privacy boundary as everywhere else Pour Stories are shown
  // to a friend (see useFriendProfile.ts's identical filter). Never the
  // friend's private, un-shared pour history.
  stories: SharedMoment[]
}

// Fetched fresh each time the quick view opens for a given (friend, bottle)
// pair rather than kept in FriendsPage/FriendProfilePage state — the sheet
// is opened from six different entry points with six different amounts of
// context already in hand (see FriendBottleQuickView.tsx), so it always
// tops up exactly what it's missing rather than requiring every caller to
// pre-fetch the same things.
export function useFriendBottleQuickView(friendUid: string | undefined, viewerUid: string | undefined, bottleName: string | undefined) {
  const [data, setData] = useState<FriendBottleQuickViewData | undefined>(undefined)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!friendUid || !bottleName) {
      setData(undefined)
      return
    }
    let cancelled = false
    setLoading(true)

    Promise.all([
      fetchProfile(friendUid).catch(() => undefined),
      getSharedMomentsForOwner(friendUid).catch(() => [] as SharedMoment[]),
      getSharedCollection(friendUid).catch(() => undefined),
    ])
      .then(([friendProfile, ownedMoments, sharedCollection]) => {
        if (cancelled) return
        const stories = ownedMoments.filter(
          (m) => m.snapshot.bottleName === bottleName && (!viewerUid || m.participantIds.includes(viewerUid)),
        )
        const bottleFacts = [...(sharedCollection?.bottles ?? []), ...(sharedCollection?.wishlist ?? [])].find((b) => b.name === bottleName)
        setData({ friendProfile, bottleFacts, stories })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [friendUid, viewerUid, bottleName])

  return { data, loading }
}
