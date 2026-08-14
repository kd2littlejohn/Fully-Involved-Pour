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
