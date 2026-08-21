import { getSharedMomentsForOwner } from '../../data/repositories/sharedMoments'
import { getMyBlindRooms, getParticipant } from '../../data/repositories/blindRoom'
import type { BlindRoom, SharedMoment } from '../../data/types'

export interface SharedBottleCount {
  name: string
  count: number
}

export interface OurWhiskeyStory {
  poursTogetherCount: number
  blindTastingsTogetherCount: number
  mostSharedBottle?: SharedBottleCount
  recentSharedMoments: SharedMoment[]
  // Rooms the viewer hosted/joined where the friend was also a participant
  // — same lookup blindTastingsTogetherCount already does, just keeping the
  // room details instead of only the count, for the full Our Whiskey Story
  // page's "Shared Blind Tastings" list.
  sharedBlindRooms: BlindRoom[]
}

const RECENT_LIMIT = 5
// Only worth calling out once a bottle has genuinely come up more than
// once between the two of you — "most shared: X (1)" isn't a real pattern.
const MIN_COUNT_FOR_MOST_SHARED = 2

// Derives everything from SharedMoment docs either of you already created
// plus BlindRoom participant records that already exist — never a new
// duplicated copy of a Pour Story or Journey entry (see
// data/repositories/sharedMoments.ts and blindRoom.ts, both reused as-is).
export async function buildOurWhiskeyStory(viewerUid: string, friendUid: string): Promise<OurWhiskeyStory> {
  const [ownedByViewer, ownedByFriend] = await Promise.all([getSharedMomentsForOwner(viewerUid), getSharedMomentsForOwner(friendUid)])

  const momentsTogether = [
    ...ownedByViewer.filter((m) => m.participantIds.includes(friendUid)),
    ...ownedByFriend.filter((m) => m.participantIds.includes(viewerUid)),
  ].sort((a, b) => b.createdAt - a.createdAt)

  const bottleCounts = new Map<string, number>()
  for (const moment of momentsTogether) {
    bottleCounts.set(moment.snapshot.bottleName, (bottleCounts.get(moment.snapshot.bottleName) ?? 0) + 1)
  }
  let mostSharedBottle: SharedBottleCount | undefined
  for (const [name, count] of bottleCounts) {
    if (count >= MIN_COUNT_FOR_MOST_SHARED && (!mostSharedBottle || count > mostSharedBottle.count)) mostSharedBottle = { name, count }
  }

  let sharedBlindRooms: BlindRoom[] = []
  try {
    const myRooms = await getMyBlindRooms(viewerUid)
    const results = await Promise.all(myRooms.map(({ room }) => getParticipant(room.id, friendUid)))
    sharedBlindRooms = myRooms.filter((_, i) => Boolean(results[i])).map(({ room }) => room)
    sharedBlindRooms.sort((a, b) => b.createdAt - a.createdAt)
  } catch (err) {
    console.error('buildOurWhiskeyStory: blind room lookup failed', err)
  }

  return {
    poursTogetherCount: momentsTogether.length,
    blindTastingsTogetherCount: sharedBlindRooms.length,
    mostSharedBottle,
    recentSharedMoments: momentsTogether.slice(0, RECENT_LIMIT),
    sharedBlindRooms,
  }
}
