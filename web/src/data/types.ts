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

export interface Bottle {
  id: string
  name: string
  distillery?: string
  type?: string
  region?: string
  imageUrl?: string
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
  location?: string
  mood?: string
  glass?: string
  weather?: string
  memory?: string
  photoUrl?: string
  buyAgain?: BuyAgain
  wouldBuyAgain?: boolean
  fip: FipBreakdown
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

export interface Profile {
  username: string
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
export type BlindSessionType = 'live' | 'challenge'
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

// One participant's private tasting notes for a single pour — stored under
// blindRooms/{roomId}/participants/{uid}/responses/{pourLabel}, readable
// and writable only by the owning participant (see firestore.rules). Not
// even the host can read another participant's responses before reveal —
// this is the "other participants' answers remain hidden" requirement.
// Kept intentionally light (reaction + free-text nose/palate/finish + a
// single overall FIP score, matching Quick Pour's pace) rather than the
// full 6-step wizard breakdown — blind tasting with friends should stay
// fast, per the app's "enhance the pour, never interrupt it" north star.
export interface BlindTastingResponse {
  pourLabel: string
  reaction?: string
  noseNotes?: string
  palateNotes?: string
  finishNotes?: string
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

// The actual hidden bottle identity behind each pour label. Stored under
// blindRoomSecrets/{roomId} — a document the host alone can read/write in
// Milestone 1 (see firestore.rules). `label` is a free string (not a hardcoded
// A-F union) so future flight formats aren't blocked by this type.
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
