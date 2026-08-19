import { createSharedMoment } from '../../data/repositories/sharedMoments'
import { createNotification } from '../../data/repositories/notifications'
import type { Bottle, Pour } from '../../data/types'

export interface ShareStoryOwner {
  uid: string
  username: string
  displayName?: string
  photoURL?: string
}

// Creates one SharedMoment (and a notification per participant) for every
// friend tagged via Pour.sharedWithUids — called right after a pour with
// tags is saved, from QuickPour and the Pour Wizard. Never throws back
// into the save flow: the pour is already safely saved by the time this
// runs, so a sharing failure is logged, not surfaced as a save error.
export async function shareStoryWithTaggedFriends(owner: ShareStoryOwner, pour: Pour, bottle: Bottle | undefined): Promise<void> {
  const participantIds = pour.sharedWithUids?.filter((uid) => uid && uid !== owner.uid) ?? []
  if (participantIds.length === 0) return

  try {
    const moment = await createSharedMoment({
      storyId: pour.id,
      ownerId: owner.uid,
      ownerUsername: owner.username,
      ownerDisplayName: owner.displayName,
      ownerPhotoURL: owner.photoURL,
      participantIds,
      snapshot: {
        bottleName: bottle?.name ?? 'A whiskey',
        distillery: bottle?.distillery,
        bottleImageUrl: bottle?.imageUrl,
        rating: pour.rating,
        occasion: pour.occasion,
        memory: pour.memory,
        date: pour.date,
      },
    })
    await Promise.all(
      participantIds.map((recipientId) =>
        createNotification({
          recipientId,
          type: 'tagged-in-pour',
          actorId: owner.uid,
          actorUsername: owner.username,
          actorDisplayName: owner.displayName,
          actorPhotoURL: owner.photoURL,
          refId: moment.id,
        }),
      ),
    )
  } catch (err) {
    console.error('shareStoryWithTaggedFriends failed', err)
  }
}
