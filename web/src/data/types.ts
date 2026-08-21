/**
 * Mirrors the existing Firestore schema exactly (see app.js's normalizeBottle /
 * savePourStory / userDocRef). Field names — including pre-existing
 * inconsistencies like the parallel coreBar/coreBarScore, buyAgain/wouldBuyAgain,
 * and categories[]/category pairs — are intentionally preserved as-is. Schema
 * cleanup is a separate, explicitly-approved change, not part of this rebuild.
 */

export type BottleStatus = 'open' | 'sealed' | 'wishlist' | 'finished' | 'incoming'
export type FillLevel = 'full' | 'three-quarter' | 'half' | 'quarter' | 'empty'
export type PourStyle = 'daily' | 'share' | 'special' | 'cocktail'
export type PourTier = 'crowd' | 'reserve' | 'vip'
export type BuyAgain = 'absolutely' | 'probably' | 'maybe' | 'probably-not' | 'no'
// Bottle-level "Your Take" fields — deliberately distinct from Pour's own
// buyAgain (a per-pour, in-the-moment reaction) since these represent the
// user's settled verdict on the bottle as a whole, set directly on Bottle
// Details rather than during a pour.
export type BottleBuyAgain = 'absolutely' | 'at-msrp' | 'maybe' | 'probably-not' | 'no'
export type WouldReplace = 'yes' | 'maybe' | 'no'

export interface GalleryPhoto {
  url: string
  caption?: string
}

export type ImageProcessingStatus = 'ready' | 'failed'

export interface Bottle {
  id: string
  name: string
  distillery?: string
  type?: string
  region?: string
  // The canonical My Bar / Bottle Details display image — a standardized
  // 4:5 FIP-treated shot (see features/photoUpload/standardizeBottlePhoto.ts)
  // whenever the photo came through the standardization pipeline, so every
  // card looks consistent regardless of how the original photo was taken.
  imageUrl?: string
  // The user's original, unprocessed upload — preserved so a photo is never
  // lost even if standardization fails or looks worse than the source.
  originalImageUrl?: string
  // Outcome of standardizing the *current* imageUrl. 'ready' = background
  // removed and centered on the FIP canvas; 'failed' = the plain original
  // was composited onto the same 4:5 canvas instead (still consistent
  // sizing/background, just not background-cleaned) — standardization is
  // synchronous and awaited before a bottle is ever saved, so there is no
  // 'pending'/'processing' state to persist here.
  imageProcessingStatus?: ImageProcessingStatus
  proof?: number
  price?: number
  msrp?: number
  mashBillCorn?: number
  mashBillRyeWheat?: number
  mashBillMalted?: number
  rating?: number
  status: BottleStatus
  ageStatement?: string
  storeLocation?: string
  shelf?: string
  quantity?: number
  fillLevel?: FillLevel
  bottleSize?: number
  purchaseDate?: string
  openedDate?: string
  expectedDate?: string
  finishedDate?: string
  categories?: string[]
  category?: string
  pourStyle?: PourStyle
  pourTier?: PourTier
  coreBar?: boolean
  coreBarScore?: number
  priority?: number
  legacyShelf?: boolean
  legacyShelfReason?: string
  flavors?: string[]
  notes?: string
  gallery?: GalleryPhoto[]
  favorite?: boolean
  createdAt?: number
  buyAgain?: BottleBuyAgain
  wouldReplace?: WouldReplace
  // UPC/EAN this bottle was originally added from, if any — the barcode
  // scan flow that used to write this has been removed, but the field
  // stays so existing bottles that already have one don't lose it.
  upc?: string
}

export interface FipBreakdown {
  nose: number
  palate: number
  finish: number
  complexity: number
  value: number
  total: number
  noseAromas: string[]
  palateFlavors: string[]
  noseNotes?: string
  palateNotes?: string
  finishNotes?: string
  complexityNotes?: string
}

export interface Pour {
  id: string
  bottleId: string
  date: string
  ounces?: number
  rating: number
  occasion?: string
  notes?: string
  companion?: string
  // Real FIP friends tagged as present for this pour (see
  // data/repositories/sharedMoments.ts) — deliberately separate from the
  // free-text `companion` field above, which every existing selector
  // (getCompanionStats, "Shared Pour" tagging, "most shared bottle")
  // already treats as a single string. Tagging someone here creates a
  // SharedMoment they can view/react/comment on; it never touches or
  // replaces `companion`.
  sharedWithUids?: string[]
  location?: string
  mood?: string
  glass?: string
  weather?: string
  memory?: string
  photoUrl?: string
  buyAgain?: BuyAgain
  wouldBuyAgain?: boolean
  fip: FipBreakdown
  // Manual "Feature This Memory" override for Journey's card feed (see
  // features/journal/journeyCardVariant.ts) — lets a user pin a pour to the
  // larger cinematic treatment regardless of score/status, and un-pin it
  // later. Absent/false means the automatic rules alone decide.
  isFeatured?: boolean
}

export interface Memory {
  id: string
  title: string
  date: string
  location?: string
  people: string[]
  bottleId?: string
  occasion?: string
  story: string
  photoUrl?: string
  createdAt?: number
}

export interface InfinityBottleAddition {
  bottleId?: string
  name: string
  amount?: string
  date?: string
}

export interface InfinityBottle {
  id: string
  name: string
  notes?: string
  additions: InfinityBottleAddition[]
}

export interface CustomLibraryEntry {
  name: string
  distillery?: string
}

export interface UserDoc {
  username?: string
  greetingMode?: string
  greetingName?: string
  updatedAt?: number
  bottles: Bottle[]
  pours: Pour[]
  memories: Memory[]
  infinityBottles: InfinityBottle[]
  customLibrary: CustomLibraryEntry[]
}

export interface UsernameRecord {
  uid: string
  username: string
}

// --- Privacy ------------------------------------------------------------
// "Do not make collections public automatically" — every new account gets
// DEFAULT_PRIVACY_SETTINGS below, the most private option in each category.
export type ProfileVisibility = 'friends' | 'fip-users'
export type CollectionVisibility = 'private' | 'friends' | 'fip-users'
export type PourStoryVisibility = 'private' | 'friends' | 'selected-friends'
export type WishListVisibility = 'private' | 'friends'

export interface PrivacySettings {
  profileVisibility: ProfileVisibility
  collectionVisibility: CollectionVisibility
  pourStoryDefault: PourStoryVisibility
  wishListVisibility: WishListVisibility
}

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  profileVisibility: 'friends',
  collectionVisibility: 'private',
  pourStoryDefault: 'private',
  wishListVisibility: 'private',
}

export interface Profile {
  // Optional, not just in theory: confirmed in production that a real
  // profiles/{uid} document can exist with only displayName/bio/location
  // set and no username at all, e.g. from an Edit Profile save that never
  // went through the separate username-claim flow (see profile.ts
  // ensureSearchableProfile for how that gets backfilled).
  username?: string
  displayName?: string
  bio?: string
  location?: string
  photoURL?: string
  // Lowercase mirrors of username/displayName, kept in sync on every
  // profile write — Firestore only supports prefix-range queries on a
  // literal field value, so search (see data/repositories/profile.ts
  // searchProfiles) reads these instead of doing this normalization at
  // query time. profiles/{uid} is already public-read (see
  // firestore.rules); these add no new exposure since username/
  // displayName are already public fields on the same doc.
  normalizedUsername?: string
  normalizedDisplayName?: string
  // Snapshot of the owner's own Whiskey Identity card (see
  // features/profile/identity.ts getWhiskeyIdentity), written whenever
  // they view their own Profile page — lets a friend's profile view show
  // "if shared" identity without ever reading the owner's private
  // bottles/pours. Never fabricated: identical to what the owner sees.
  whiskeyIdentityTags?: string[]
  whiskeyIdentityDescription?: string
  privacy?: PrivacySettings
}

export interface Follow {
  followerUid: string
  followerUsername: string
  followingUid: string
  followingUsername: string
  createdAt: number
}

export interface Reaction {
  ownerUid: string
  bottleId: string
  reactorUid: string
  reactorUsername: string
  emoji: string
  createdAt: number
}

export interface FaceoffVote {
  pairKey: string
  aName: string
  bName: string
  winner: string
  voterUid: string
  voterUsername: string
}

export interface SharedBottlePhoto {
  name: string
  distillery?: string
  imageUrl: string
  submittedBy: string
  submittedAt: number
}

// Blind Room — remote blind whiskey tastings. Lives in its own top-level
// Firestore collections (blindRooms/blindRoomCodes/blindRoomSecrets), never
// inside the per-user users/{uid} doc, since a room is shared across
// multiple users' accounts. See firestore.rules for the access boundary —
// BlindSecretPour in particular must never be readable by a non-host
// participant before reveal (Milestone 3+); Milestone 1 only creates and
// stores it, it doesn't yet unlock participant reads.
// 'solo' is a single-taster session — same hide/taste/score/rank/reveal
// pipeline, just skipping the lobby/invite/ready-up steps that only make
// sense with other participants (see createBlindRoom in blindRoom.ts).
export type BlindSessionType = 'solo' | 'live' | 'challenge'
export type BlindKnowledgeMode = 'single' | 'double'
export type BlindRoomState =
  | 'draft'
  | 'lobby'
  | 'active'
  | 'awaiting_final_rank'
  | 'awaiting_reveal'
  | 'revealed'
  | 'completed'
  | 'cancelled'
export type BlindParticipantStatus = 'invited' | 'joined' | 'ready' | 'tasting' | 'completed' | 'revealed'

export interface BlindRoom {
  id: string
  code: string
  name: string
  hostUid: string
  hostUsername: string
  sessionType: BlindSessionType
  knowledgeMode: BlindKnowledgeMode
  pourCount: number
  // Bottle NAMES only (Single Blind mode only), stored in a shuffled order
  // that carries no relationship to the hidden A/B/C/... mapping — knowing
  // the lineup is not knowing which pour is which.
  knownLineup?: string[]
  state: BlindRoomState
  deadline?: number
  createdAt: number
  startedAt?: number
  revealedAt?: number
  completedAt?: number
  participantCount: number
}

export interface BlindParticipant {
  uid: string
  username: string
  isHost: boolean
  status: BlindParticipantStatus
  joinedAt: number
  readyAt?: number
  startedTastingAt?: number
  completedAt?: number
}

export type BlindResponseStatus = 'in-progress' | 'locked'

// How much hand-holding the Sommelier gives during a tasting — chosen once
// at the start of each session (see features/blindSommelier), remembered
// locally as the default for next time. Not synced to Firestore: it's a UX
// preference, not journal data.
export type BlindGuidanceLevel = 'guide' | 'casual' | 'minimal'

// Internal mapping of the "after you swallow" answer to something
// comparable across pours — the user's own words (finishImpression) are
// always preserved alongside it; this is never shown back to them verbatim.
export type BlindFinishLength = 'short' | 'medium' | 'long' | 'building'

// One participant's private tasting notes for a single pour — stored under
// blindRooms/{roomId}/participants/{uid}/responses/{pourLabel}, readable
// and writable only by the owning participant (see firestore.rules). Not
// even the host can read another participant's responses before reveal —
// this is the "other participants' answers remain hidden" requirement.
// Kept intentionally light (reaction + a few tapped, structured answers +
// an optional overall FIP score, matching Quick Pour's pace) rather than
// the full 6-step wizard breakdown — blind tasting with friends should stay
// fast, per the app's "enhance the pour, never interrupt it" north star.
// noseNotes/palateNotes/finishNotes are legacy free-text fields from before
// the guided Sommelier flow (see BlindTastingPage) — kept for old locked
// responses that still have them, no longer written by new tastings.
export interface BlindTastingResponse {
  pourLabel: string
  reaction?: string
  noseNotes?: string
  palateNotes?: string
  finishNotes?: string
  complexityNotes?: string
  noseTags?: string[]
  palateTags?: string[]
  finishTags?: string[]
  complexityTags?: string[]
  noseBroad?: string
  noseDetail?: string
  likedCharacteristic?: string
  finishImpression?: string
  finishLength?: BlindFinishLength
  proofGuess?: number
  ageGuess?: string
  typeGuess?: string
  distilleryGuess?: string
  fipScore?: number
  notes?: string
  status: BlindResponseStatus
  updatedAt: number
  lockedAt?: number
}

// One head-to-head preference call made mid-tasting — "which would you
// rather pour another glass of?" — stored under
// blindRooms/{roomId}/participants/{uid}/comparisons/{comparisonId}, same
// self-only-until-reveal access pattern as responses/ranking (see
// firestore.rules). For a flight of N pours, tastings record a running
// N-1 comparison chain (each new pour compared against the current
// favorite) rather than every possible pair, so this never turns into an
// interrogation.
export type BlindComparisonReason =
  | 'better-smell'
  | 'better-flavor'
  | 'better-finish'
  | 'less-heat'
  | 'more-flavor'
  | 'better-balance'
  | 'simply-enjoyed-more'

export interface BlindComparison {
  id: string
  pairLabels: [string, string]
  winnerLabel: string
  reason?: BlindComparisonReason
  updatedAt: number
}

// A participant's private, ranked preference across every pour in the
// room — stored under blindRooms/{roomId}/participants/{uid}/ranking/final,
// same self-only-until-locked, hidden-until-reveal access pattern as
// BlindTastingResponse (see firestore.rules). `order` lists pour labels
// from most- to least-favorite; only ever meaningful once its length
// matches the room's pourCount, i.e. once it's locked.
export type BlindRankingStatus = 'in-progress' | 'locked'

export interface BlindFinalRanking {
  order: string[]
  status: BlindRankingStatus
  updatedAt: number
  lockedAt?: number
}

// The actual hidden bottle identity behind each pour label. Stored under
// blindRoomSecrets/{roomId} — readable/writable by the host at any time,
// and readable (never writable) by any participant once the host reveals
// (room.state === 'revealed'; see firestore.rules). `label` is a free
// string (not a hardcoded A-F union) so future flight formats aren't
// blocked by this type.
export interface BlindSecretPour {
  label: string
  bottleId: string
  bottleName: string
  distillery?: string
  imageUrl?: string
  proof?: number
}

export interface BlindRoomSecrets {
  roomId: string
  pours: BlindSecretPour[]
}

export interface BlindRoomCode {
  roomId: string
  createdAt: number
}

// ---------------------------------------------------------------------------
// Friends / social — "share the pour, not your whole life." Deliberately not
// a feed: every collection below exists to back a specific, meaningful
// interaction (a request, a tagged pour, a recommendation), never a
// scrollable timeline of everything a user does. See
// data/repositories/{relationships,sharedMoments,recommendations,
// notifications,sharedCollections}.ts.

// A friendship is mutual and symmetric — one doc per pair, keyed by sorted
// uids (relationships/{uidA}_{uidB}, uidA < uidB), covering both terminal
// states a pair of users can be in. Everything in between ("none",
// "outgoing_pending", "incoming_pending") is derived from the ABSENCE of a
// relationship doc plus whichever FriendRequest exists, never stored here.
// Blocking is directional in effect even though the doc is shared: whichever
// uid is NOT `requestedBy` is the one being blocked from interacting with
// the blocker, never the other way around.
export type RelationshipStatus = 'friends' | 'blocked'

export interface Relationship {
  id: string
  userIds: [string, string]
  status: RelationshipStatus
  requestedBy: string
  createdAt: number
  updatedAt: number
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'

// friendRequests/{senderId}_{receiverId} — direction is part of the doc id,
// unlike Relationship. Sender fields are a display snapshot (see
// profiles/{uid}, already public) so the receiver's request card never
// needs a second read.
export interface FriendRequest {
  id: string
  senderId: string
  senderUsername: string
  senderDisplayName?: string
  senderPhotoURL?: string
  receiverId: string
  status: FriendRequestStatus
  createdAt: number
  updatedAt: number
}

// A tasting moment shared with specific tagged friends — created when a Pour
// Story names real FIP friends (Pour.sharedWithUids), not a general "friends
// can browse my pours" feed. `snapshot` exists because Pour docs live inside
// the owner's private users/{uid} doc (see firestore.rules) which a
// participant can never read directly; this is the same "store a viewer-safe
// snapshot at write time" pattern blindRoomSecrets already uses for hidden
// bottle identities. Tagging never transfers ownership — a participant can
// react/comment/add their own note (see sharedMoments/{id}/participantNotes)
// but the story itself always belongs to `ownerId`.
export interface SharedMomentSnapshot {
  bottleName: string
  distillery?: string
  bottleImageUrl?: string
  rating?: number
  occasion?: string
  memory?: string
  date: string
}

export interface SharedMoment {
  id: string
  storyId: string
  ownerId: string
  ownerUsername: string
  ownerDisplayName?: string
  ownerPhotoURL?: string
  participantIds: string[]
  acceptedParticipantIds: string[]
  snapshot: SharedMomentSnapshot
  createdAt: number
}

export interface SharedMomentParticipantNote {
  uid: string
  note: string
  updatedAt: number
}

export type StoryReactionType = 'cheers' | 'great-pour' | 'need-to-try' | 'good-notes'

// storyReactions/{sharedMomentId}_{uid} — one reaction per person per
// story; reacting again with a different type just overwrites this same
// doc rather than stacking. No public like *counts* are surfaced as a
// metric — see features/friends/reactions.ts.
export interface StoryReaction {
  id: string
  sharedMomentId: string
  uid: string
  type: StoryReactionType
  createdAt: number
}

export interface StoryComment {
  id: string
  sharedMomentId: string
  authorId: string
  authorUsername: string
  authorDisplayName?: string
  authorPhotoURL?: string
  text: string
  createdAt: number
}

export type RecommendationStatus = 'pending' | 'added-to-wishlist' | 'dismissed'

// A bottle recommendation is also a snapshot, for the same reason as
// SharedMomentSnapshot — bottleId only resolves inside the sender's own
// private collection, so the recipient needs display fields copied at
// send time, not a live reference.
export interface Recommendation {
  id: string
  senderId: string
  senderUsername: string
  senderDisplayName?: string
  senderPhotoURL?: string
  recipientId: string
  bottleName: string
  bottleDistillery?: string
  bottleImageUrl?: string
  message?: string
  status: RecommendationStatus
  createdAt: number
}

export type NotificationType =
  | 'friend-request-received'
  | 'friend-request-accepted'
  | 'tagged-in-pour'
  | 'bottle-recommended'
  | 'story-reaction'
  | 'story-comment'

// Named AppNotification (not Notification) to avoid colliding with the DOM
// global. `refId` is the id of whatever this points to (a FriendRequest,
// SharedMoment, or Recommendation), so a tap can route straight to it.
export interface AppNotification {
  id: string
  recipientId: string
  type: NotificationType
  actorId: string
  actorUsername: string
  actorDisplayName?: string
  actorPhotoURL?: string
  refId: string
  // The bottle the notification is actually about, where one exists (every
  // type except friend-request-received/accepted) — set at each
  // createNotification call site from data already in scope there (see
  // shareStoryOnSave.ts, ReactionBar.tsx, CommentsList.tsx,
  // RecommendToFriendModal.tsx, RecommendBottleModal.tsx). Optional and
  // additive: older notification docs written before this field existed
  // just render without a bottle line, never break.
  refBottleName?: string
  read: boolean
  createdAt: number
}

// A lightweight summary of ONLY the bottles/wishlist items the owner's own
// privacy settings currently allow friends (or all FIP users) to see —
// synced from their real collection (see
// data/repositories/sharedCollections.ts buildSharedCollectionProjection),
// never computed live from another user's private users/{uid} doc, which
// no one but its owner can ever read. Backs "Bottles We Both Own," a
// friend's shared bottles, and their Wish List when they've allowed it.
export interface SharedBottleSummary {
  id: string
  name: string
  distillery?: string
  imageUrl?: string
  status: BottleStatus
  // Deliberately limited to fields that describe the BOTTLE, not the
  // owner — "share the pour, not your whole life" (see the friends/social
  // rules comment in firestore.rules). Purchase price, store, purchase
  // date, personal notes, quantity/fill level are never projected here,
  // no matter what privacy settings allow — sharing "I own this bottle"
  // doesn't imply sharing what it cost or where you keep it.
  type?: string
  region?: string
  proof?: number
  ageStatement?: string
  // The owner's own opinion of THIS bottle — separate from the bottle
  // facts above, and gated by a stricter, separate privacy setting
  // (pourStoryDefault === 'friends', not just collectionVisibility — see
  // buildFriendBottleTake in data/repositories/sharedCollections.ts).
  // Undefined whenever that setting isn't 'friends', regardless of
  // whether the bottle itself is visible.
  take?: FriendBottleTake
}

// The owner's own aggregate take on one bottle, computed from their own
// Pours at write time (data/repositories/sharedCollections.ts) — never a
// live read of another user's private data. See FriendBottleQuickView.tsx.
export interface FriendBottleTake {
  // FIP total from the owner's most recent pour of this bottle, or the
  // bottle's own settled rating if they haven't logged a pour of it yet.
  score?: number
  // The most recent pour's memory (fallback: notes), trimmed — the same
  // kind of excerpt a SharedMoment already carries when explicitly tagged,
  // just surfaced here for every pour of this bottle rather than one.
  latestTake?: string
  buyAgain?: BottleBuyAgain
  wouldReplace?: WouldReplace
  topFlavors?: string[]
  pourCount: number
  lastPourDate?: string
}

export interface SharedCollection {
  uid: string
  bottles: SharedBottleSummary[]
  wishlist: SharedBottleSummary[]
  updatedAt: number
}
