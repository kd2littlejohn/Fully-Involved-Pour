import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { isMockAuthEnabled } from '../devMode'
import type { PrivacySettings, SharedBottleSummary, SharedCollection, UserDoc } from '../types'

const mockSharedCollections = new Map<string, SharedCollection>()

// Only what the owner's own privacy settings currently allow friends (or
// all FIP users) to see — computed here and written by the owner's OWN
// client. Never derived live from another user's private users/{uid} doc,
// which only its owner can ever read (see firestore.rules). Kept as a
// separate collection rather than granting friends any access to the raw
// doc: collectionVisibility and wishListVisibility are independent
// settings even though bottles and wishlist items live in the same
// users/{uid} array, so field-level Firestore rules alone can't honor
// them separately — this projection does that filtering once, at write
// time, instead.
export function buildSharedCollectionProjection(uid: string, userDoc: UserDoc, privacy: PrivacySettings): SharedCollection {
  const toSummary = (bottle: UserDoc['bottles'][number]): SharedBottleSummary => ({
    id: bottle.id,
    name: bottle.name,
    distillery: bottle.distillery,
    imageUrl: bottle.imageUrl,
    status: bottle.status,
    type: bottle.type,
    region: bottle.region,
    proof: bottle.proof,
    ageStatement: bottle.ageStatement,
  })

  const bottles = privacy.collectionVisibility === 'private' ? [] : userDoc.bottles.filter((b) => b.status !== 'wishlist').map(toSummary)
  const wishlist = privacy.wishListVisibility === 'private' ? [] : userDoc.bottles.filter((b) => b.status === 'wishlist').map(toSummary)

  return { uid, bottles, wishlist, updatedAt: Date.now() }
}

// Not wired into every bottle mutation — called when the owner changes a
// privacy setting (features/friends/PrivacyControls.tsx) or visits their
// own Profile page (pages/Profile/ProfilePage.tsx), so a friend's view of
// "Bottles We Both Own" / shared bottles / Wish List is refreshed on the
// owner's next visit to either of those rather than instantly on every add.
export async function syncSharedCollection(uid: string, userDoc: UserDoc, privacy: PrivacySettings): Promise<void> {
  const projection = buildSharedCollectionProjection(uid, userDoc, privacy)
  if (isMockAuthEnabled()) {
    mockSharedCollections.set(uid, projection)
    return
  }
  await setDoc(doc(db, 'sharedCollections', uid), projection)
}

export async function getSharedCollection(uid: string): Promise<SharedCollection | undefined> {
  if (isMockAuthEnabled()) return mockSharedCollections.get(uid)
  const snap = await getDoc(doc(db, 'sharedCollections', uid))
  return snap.exists() ? (snap.data() as SharedCollection) : undefined
}
