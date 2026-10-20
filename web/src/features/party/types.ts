// Blind Room Party Mode — client-side shapes of the documents written by
// the partyAction Cloud Function (functions/party/service.js). The client
// never writes any of these directly; see firestore.rules for who may read
// each one.

export type PartyStatus = 'setup' | 'live' | 'completed'
export type PartyCategoryState = 'draft' | 'ready' | 'voting_open' | 'voting_closed' | 'revealed'
export type PartyScoringMode = 'quick' | 'detailed'
export type BallotSource = 'digital' | 'paper'

export interface PartySettings {
  defaultScoring: PartyScoringMode
  allowEdits: boolean
  manualVoting: boolean
  revealByCategory: boolean
  showNicknames: boolean
  predictions: boolean
}

export const DEFAULT_PARTY_SETTINGS: PartySettings = {
  defaultScoring: 'quick',
  allowEdits: true,
  manualVoting: true,
  revealByCategory: true,
  showNicknames: true,
  predictions: false,
}

// One round of the event. Name/description are a snapshot taken when the
// category was added, so later edits to the reusable library never change
// a party's history. `libraryId` is the stable id it came from, if any.
export interface PartyCategory {
  id: string
  libraryId: string | null
  name: string
  description: string
  state: PartyCategoryState
  sampleLabels: string[]
  lockedAt: number | null
  votingOpenedAt: number | null
  votingClosedAt: number | null
  revealedAt: number | null
  createdAt: number
  // Regular tastings only: what everyone sees about each sample's bottle.
  bottles?: Record<string, PartyPublicBottle>
}

// A regular tasting's visible bottle — never the host's price or My Bar id.
export interface PartyPublicBottle {
  name: string
  distillery?: string
  type?: string
  age?: string
  proof?: number
  imageUrl?: string
}

// 'blind' hides bottles until reveal; 'regular' shows them from the start.
// Absent on parties created before formats existed, which are blind.
export type PartyFormat = 'blind' | 'regular'

export function partyFormat(party: Pick<Party, 'format'>): PartyFormat {
  return party.format === 'regular' ? 'regular' : 'blind'
}

export interface Party {
  id: string
  hostUid: string
  hostName: string
  // "I'm tasting too". Absent on parties created before host participation.
  hostTasting?: boolean
  format?: PartyFormat
  // Co-hosts / pour assistants: other FIP accounts who run the event and
  // hold the bottle key, so the host can taste blind. They never taste.
  coHostUids?: string[]
  coHosts?: Record<string, { name: string; addedAt: number }>
  // When the host first knew each round's bottles (set them up or opened
  // the bottle key). Their ballots in those rounds are marked not fully blind.
  hostKeyViews?: Record<string, number>
  name: string
  description: string
  eventDate: string | null
  coverImageUrl: string
  capacity: number | null
  status: PartyStatus
  settings: PartySettings
  categories: PartyCategory[]
  currentCategoryId: string | null
  joinCode: string
  inviteActive: boolean
  inviteExpiresAt: number | null
  counts: { guests: number; digital: Record<string, number>; paper: Record<string, number> }
  recapNotes?: string
  createdAt: number
  updatedAt: number
  completedAt: number | null
}

// A competing bottle as snapshotted into the host-only mapping.
export interface PartyBottle {
  name: string
  distillery?: string
  type?: string
  age?: string
  proof?: number
  price?: number
  imageUrl?: string
  bottleId?: string
  source: 'my-bar' | 'manual' | 'catalog'
}

export interface PartySample {
  id: string
  label: string
  bottle: PartyBottle
}

// partySecrets/{partyId} — readable by the host only.
export interface PartySecrets {
  partyId: string
  hostUid: string
  categories: Record<string, { samples: PartySample[] }>
}

export interface PartyGuest {
  uid: string
  participantKey: string
  nickname: string
  joinedAt: number
  revoked: boolean
  isAccount?: boolean
  // The host's own record when they're tasting too. Not a counted guest.
  isHost?: boolean
}

// parties/{partyId}/roster/{id}: the public "Who's Tasting" list, written
// by the server and readable by every member of the party. Only what the
// shared list shows: never a uid, email, score or note.
export type PartyRosterRole = 'host' | 'cohost' | 'guest'
export type PartyRosterProgress = 'tasting' | 'submitted'

export interface PartyRosterEntry {
  // A guest's participant key, "host", or a one-way hash for a co-host.
  id: string
  name: string
  role: PartyRosterRole
  // Counted in "N tasting". Co-hosts never taste; the host may or may not.
  tasting: boolean
  joinedAt: number
  progress: Record<string, PartyRosterProgress>
}

export interface PartySampleScore {
  overall: number
  nose?: number
  palate?: number
  finish?: number
  complexity?: number
  descriptors?: string[]
  notes?: string
}

export interface PartyBallot {
  id: string
  partyId: string
  categoryId: string
  participantKey: string
  source: BallotSource
  ownerUid: string
  nickname?: string
  ballotNumber?: string
  mode: PartyScoringMode
  scores: Record<string, PartySampleScore>
  favoriteLabel: string | null
  predictionLabel: string | null
  excluded: boolean
  excludedReason?: string | null
  // A host ballot made after they knew this round's bottles. Counted.
  unblinded?: boolean
  createdAt: number
  updatedAt: number
  revision: number
}

// Host view of a ballot (listBallots). Digital ballots never include scores.
export interface PartyBallotSummary {
  id: string
  source: BallotSource
  nickname: string
  ballotNumber: string
  scoredCount: number
  hasFavorite: boolean
  excluded: boolean
  excludedReason: string | null
  updatedAt: number
  revision: number
  scores?: Record<string, PartySampleScore>
  favoriteLabel?: string | null
  predictionLabel?: string | null
  mode?: PartyScoringMode
}

export interface PartyPublicBottle {
  name: string
  distillery?: string
  type?: string
  age?: string
  imageUrl?: string
  proof?: number
  price?: number
}

export interface PartyResultSample {
  label: string
  bottle: PartyPublicBottle
  average: number | null
  count: number
  rank: number | null
  favoriteVotes: number
  isChampion: boolean
  isPeoplesChoice: boolean
}

export interface PartyAward {
  id: 'category-champion' | 'peoples-choice' | 'best-value' | 'biggest-surprise'
  title: string
  labels: string[]
  detail: string
}

export interface PartyGuestScores {
  participantKey: string
  name: string
  source: BallotSource
  scores: Record<string, number>
  favoriteLabel: string | null
  unblinded?: boolean
}

// parties/{partyId}/results/{categoryId} — exists only once revealed.
export interface PartyCategoryResults {
  partyId: string
  categoryId: string
  name: string
  description: string
  samples: PartyResultSample[]
  champions: string[]
  peoplesChoice: string[]
  awards: PartyAward[]
  ballotsCounted: number
  // Counted ballots that may not have been fully blind. Absent on results
  // revealed before blind-integrity tracking existed.
  unblindedBallots?: number
  ratingsCounted: number
  guestScores: PartyGuestScores[]
  revealedAt: number
}

export interface PartyRecapWinner {
  label: string
  bottle: PartyPublicBottle
  average?: number | null
  count?: number
  favoriteVotes?: number
}

// parties/{partyId}/results/recap — written when the host completes the party.
export interface PartyRecap {
  partyId: string
  partyName: string
  eventDate: string | null
  categories: { categoryId: string; name: string }[]
  bottles: PartyPublicBottle[]
  champions: { categoryId: string; categoryName: string; winners: PartyRecapWinner[] }[]
  peoplesChoice: { categoryId: string; categoryName: string; winners: PartyRecapWinner[] }[]
  highestRated: { categoryId: string; categoryName: string; label: string; bottle: PartyPublicBottle; average: number; count: number }[]
  participantCount: number
  totalBallots: number
  notes: string
  completedAt: number
}

export interface PartyPreview {
  partyId: string
  name: string
  description: string
  eventDate: string | null
  coverImageUrl: string
  hostName: string
  status: PartyStatus
  categoryCount: number
  joinBlocker: string | null
  guest: { nickname: string } | null
  isHost: boolean
}

// users/{uid}/partyCategories/{id} — a host's saved custom category.
export interface SavedTastingCategory {
  id: string
  name: string
  description: string
  createdAt: number
  updatedAt: number
}

// users/{uid}/partyTemplates/{id} — a reusable category setup.
export interface PartyTemplate {
  id: string
  name: string
  categories: { libraryId: string | null; name: string; description: string }[]
  createdAt: number
}
