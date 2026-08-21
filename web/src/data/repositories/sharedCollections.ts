import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { isMockAuthEnabled } from '../devMode'
import type { Bottle, FriendBottleTake, Pour, PrivacySettings, SharedBottleSummary, SharedCollection, UserDoc } from '../types'

const mockSharedCollections = new Map<string, SharedCollection>()

const TOP_FLAVORS_LIMIT = 4

// The owner's own opinion of one bottle, for Friend Bottle Quick View (see
// features/friends/FriendBottleQuickView.tsx) — computed from their own
// Pours, same as features/bottleDetails/selectors.ts's getCurrentScore
// would, but kept local rather than imported: this is data/repositories/,
// and that selector lives in features/ — importing a feature module from
// the data layer would invert the app's dependency direction.
function buildFriendBottleTake(bottle: Bottle, pours: Pour[]): FriendBottleTake | undefined {
  const bottlePours = pours.filter((p) => p.bottleId === bottle.id).sort((a, b) => b.date.localeCompare(a.date))
  const latest = bottlePours[0]
  if (!latest && bottle.rating === undefined && !bottle.buyAgain && !bottle.wouldReplace && !bottle.flavors?.length) return undefined

  return {
    score: latest?.rating ?? bottle.rating,
    latestTake: latest?.memory?.trim() || latest?.notes?.trim() || undefined,
    buyAgain: bottle.buyAgain,
    wouldReplace: bottle.wouldReplace,
    topFlavors: bottle.flavors && bottle.flavors.length > 0 ? bottle.flavors.slice(0, TOP_FLAVORS_LIMIT) : undefined,
    pourCount: bottlePours.length,
    lastPourDate: latest?.date,
  }
}

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
  // A friend's opinion of a bottle (score, take, buy-again/replace,
  // flavors, pour history) is more personal than just owning it, so it's
  // gated by its own setting — pourStoryDefault, the one privacy control
  // that already exists to answer "can friends see my pour details" but
  // had nothing reading it until this feature. 'selected-friends' is
  // treated the same as 'private' here: there's no per-friend selection
  // mechanism built anywhere yet, so honoring it as "not everyone" would
  // require guessing who's selected.
  const includeTake = privacy.pourStoryDefault === 'friends'

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
    take: includeTake ? buildFriendBottleTake(bottle, userDoc.pours) : undefined,
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
