// Development-only sample social data — friends, a pending request, a
// shared pour, a recommendation, and a couple of reactions, all keyed
// against MOCK_USER.uid ('dev-preview-user'; see mockAuth.ts). Only ever
// imported behind isMockAuthEnabled() (see devMode.ts), so this never
// reaches a production bundle and never touches real Firestore — kept
// completely separate from any production account or query. Bottle/person
// names here are deliberately different from any design-reference mockup;
// nothing here is meant to resemble a real FIP user.
import type { AppNotification, FriendRequest, Recommendation, Relationship, SharedMoment, StoryComment, StoryReaction } from './types'

export const MOCK_OWNER_UID = 'dev-preview-user'

export interface MockFriendProfile {
  uid: string
  username: string
  displayName: string
  location?: string
  whiskeyIdentityTags?: string[]
}

export const MOCK_FRIEND_PROFILES: MockFriendProfile[] = [
  { uid: 'mock-sam', username: 'sampours', displayName: 'Sam Rivera', location: 'Louisville, KY', whiskeyIdentityTags: ['Bourbon', 'Oak-Forward', 'Higher Proof'] },
  { uid: 'mock-alex', username: 'alexbarrel', displayName: 'Alex Kim', location: 'Chicago, IL', whiskeyIdentityTags: ['Rye', 'Spice-Forward'] },
  { uid: 'mock-priya', username: 'priyaproof', displayName: 'Priya Patel', location: 'Austin, TX', whiskeyIdentityTags: ['Bourbon', 'Sweet', 'Rich'] },
  { uid: 'mock-jordan', username: 'jordanrye', displayName: 'Jordan Lee', location: 'Nashville, TN', whiskeyIdentityTags: ['Tennessee Whiskey'] },
  { uid: 'mock-taylor', username: 'taylorcask', displayName: 'Taylor Brooks', location: 'Denver, CO', whiskeyIdentityTags: ['American Single Malt'] },
]

// Sam, Alex, and Priya are already friends; Jordan has an incoming request
// pending; Taylor is unconnected (shows up in search only).
export const MOCK_RELATIONSHIPS: Relationship[] = [
  {
    id: [MOCK_OWNER_UID, 'mock-sam'].sort().join('_'),
    userIds: [MOCK_OWNER_UID, 'mock-sam'].sort() as [string, string],
    status: 'friends',
    requestedBy: 'mock-sam',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 40,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 40,
  },
  {
    id: [MOCK_OWNER_UID, 'mock-alex'].sort().join('_'),
    userIds: [MOCK_OWNER_UID, 'mock-alex'].sort() as [string, string],
    status: 'friends',
    requestedBy: MOCK_OWNER_UID,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 20,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 20,
  },
  {
    id: [MOCK_OWNER_UID, 'mock-priya'].sort().join('_'),
    userIds: [MOCK_OWNER_UID, 'mock-priya'].sort() as [string, string],
    status: 'friends',
    requestedBy: 'mock-priya',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
  },
]

export const MOCK_FRIEND_REQUESTS: FriendRequest[] = [
  {
    id: `mock-jordan_${MOCK_OWNER_UID}`,
    senderId: 'mock-jordan',
    senderUsername: 'jordanrye',
    senderDisplayName: 'Jordan Lee',
    receiverId: MOCK_OWNER_UID,
    status: 'pending',
    createdAt: Date.now() - 1000 * 60 * 60 * 6,
    updatedAt: Date.now() - 1000 * 60 * 60 * 6,
  },
]

export const MOCK_SHARED_MOMENT_ID = 'mock-moment-1'

export const MOCK_SHARED_MOMENTS: SharedMoment[] = [
  {
    id: MOCK_SHARED_MOMENT_ID,
    storyId: 'mock-pour-1',
    ownerId: 'mock-sam',
    ownerUsername: 'sampours',
    ownerDisplayName: 'Sam Rivera',
    participantIds: [MOCK_OWNER_UID],
    acceptedParticipantIds: [],
    snapshot: {
      bottleName: 'Wild Turkey Rare Breed',
      distillery: 'Wild Turkey Distilling Co.',
      rating: 8.7,
      occasion: 'Friday wind-down',
      memory: 'Split this after a long week — the rye spice really opened up after a few minutes.',
      date: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString().slice(0, 10),
    },
    createdAt: Date.now() - 1000 * 60 * 60 * 20,
  },
]

export const MOCK_RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'mock-rec-1',
    senderId: 'mock-alex',
    senderUsername: 'alexbarrel',
    senderDisplayName: 'Alex Kim',
    recipientId: MOCK_OWNER_UID,
    bottleName: 'Elijah Craig Barrel Proof',
    bottleDistillery: 'Heaven Hill Distillery',
    message: 'Think you’d like this one — big oak and dried fruit, reminded me of your last few picks.',
    status: 'pending',
    createdAt: Date.now() - 1000 * 60 * 60 * 30,
  },
]

export const MOCK_REACTIONS: StoryReaction[] = [
  { id: `${MOCK_SHARED_MOMENT_ID}_mock-priya`, sharedMomentId: MOCK_SHARED_MOMENT_ID, uid: 'mock-priya', type: 'cheers', createdAt: Date.now() - 1000 * 60 * 60 * 10 },
]

export const MOCK_COMMENTS: StoryComment[] = [
  {
    id: 'mock-comment-1',
    sharedMomentId: MOCK_SHARED_MOMENT_ID,
    authorId: 'mock-priya',
    authorUsername: 'priyaproof',
    authorDisplayName: 'Priya Patel',
    text: 'Been meaning to try this one, moving it up the list.',
    createdAt: Date.now() - 1000 * 60 * 60 * 9,
  },
]

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'mock-notif-1',
    recipientId: MOCK_OWNER_UID,
    type: 'friend-request-received',
    actorId: 'mock-jordan',
    actorUsername: 'jordanrye',
    actorDisplayName: 'Jordan Lee',
    refId: `mock-jordan_${MOCK_OWNER_UID}`,
    read: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 6,
  },
  {
    id: 'mock-notif-2',
    recipientId: MOCK_OWNER_UID,
    type: 'bottle-recommended',
    actorId: 'mock-alex',
    actorUsername: 'alexbarrel',
    actorDisplayName: 'Alex Kim',
    refId: 'mock-rec-1',
    read: false,
    createdAt: Date.now() - 1000 * 60 * 60 * 30,
  },
  {
    id: 'mock-notif-3',
    recipientId: MOCK_OWNER_UID,
    type: 'tagged-in-pour',
    actorId: 'mock-sam',
    actorUsername: 'sampours',
    actorDisplayName: 'Sam Rivera',
    refId: MOCK_SHARED_MOMENT_ID,
    read: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 20,
  },
]
