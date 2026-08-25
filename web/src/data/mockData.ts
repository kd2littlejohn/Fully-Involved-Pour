import type { Bottle, InfinityBottle, Memory, Pour, PourPerson, UserDoc } from './types'

// Dev-only fixture collection — lets every page be exercised against
// realistic populated data (multiple statuses, companions, FIP tiers,
// journey stages) without needing a real Google-authenticated Firestore
// session. Only ever imported dynamically behind isMockAuthEnabled()
// (devMode.ts) so it never reaches a production bundle.
function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

function daysFromNow(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const eagleRare: Bottle = {
  id: 'mock-eagle-rare',
  name: 'Eagle Rare 10 Year',
  distillery: 'Buffalo Trace',
  type: 'Bourbon',
  region: 'Kentucky',
  proof: 90,
  price: 34.99,
  msrp: 39.99,
  ageStatement: '10 Years',
  status: 'open',
  openedDate: daysAgo(3),
  bottleSize: 750,
  fillLevel: 'three-quarter',
  quantity: 1,
  favorite: true,
  flavors: ['Caramel', 'Toffee', 'Orange Peel'],
  notes: 'Always reliable. Great daily pour.',
  createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
}

const wellerSpecial: Bottle = {
  id: 'mock-weller-12',
  name: 'W.L. Weller 12 Year',
  distillery: 'Buffalo Trace',
  type: 'Wheated Bourbon',
  proof: 90,
  price: 29.99,
  status: 'open',
  openedDate: daysAgo(20),
  bottleSize: 750,
  fillLevel: 'half',
  quantity: 1,
  createdAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
}

const blantons: Bottle = {
  id: 'mock-blantons',
  name: "Blanton's Original",
  distillery: 'Buffalo Trace',
  type: 'Single Barrel Bourbon',
  proof: 93,
  price: 64.99,
  status: 'open',
  openedDate: daysAgo(60),
  bottleSize: 750,
  fillLevel: 'quarter',
  quantity: 1,
  legacyShelf: true,
  legacyShelfReason: 'First bourbon I ever loved',
  createdAt: Date.now() - 200 * 24 * 60 * 60 * 1000,
}

const pappy15: Bottle = {
  id: 'mock-pappy-15',
  name: 'Pappy Van Winkle 15 Year',
  distillery: 'Old Rip Van Winkle',
  type: 'Bourbon',
  proof: 107,
  msrp: 119.99,
  status: 'wishlist',
  priority: 1,
  createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
}

const fourRoses: Bottle = {
  id: 'mock-four-roses',
  name: 'Four Roses Small Batch',
  distillery: 'Four Roses',
  type: 'Bourbon',
  proof: 90,
  price: 27.99,
  status: 'sealed',
  quantity: 2,
  shelf: 'Top shelf, left',
  createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
}

const oldGrandDad: Bottle = {
  id: 'mock-old-grand-dad',
  name: 'Old Grand-Dad Bonded',
  distillery: 'Jim Beam',
  type: 'Bourbon',
  proof: 100,
  price: 19.99,
  status: 'finished',
  openedDate: daysAgo(120),
  createdAt: Date.now() - 300 * 24 * 60 * 60 * 1000,
}

const elmerTLee: Bottle = {
  id: 'mock-elmer-t-lee',
  name: 'Elmer T. Lee Single Barrel',
  distillery: 'Buffalo Trace',
  type: 'Single Barrel Bourbon',
  proof: 90,
  price: 34.99,
  status: 'incoming',
  storeLocation: 'Allocated — ABC Liquor waitlist',
  expectedDate: daysFromNow(9),
  createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
}

const dad: PourPerson = { id: 'mock-person-dad', name: 'Dad', normalizedName: 'dad', createdAt: Date.now() - 300 * 24 * 60 * 60 * 1000 }
const mike: PourPerson = { id: 'mock-person-mike', name: 'Mike', normalizedName: 'mike', createdAt: Date.now() - 100 * 24 * 60 * 60 * 1000 }
const sarah: PourPerson = { id: 'mock-person-sarah', name: 'Sarah', normalizedName: 'sarah', createdAt: Date.now() - 200 * 24 * 60 * 60 * 1000 }

// Deliberately no photoUrl on any of these — exercises the initials-fallback
// avatar state by default, same convention as bottles having no imageUrl in
// this fixture set.
const people: PourPerson[] = [dad, mike, sarah]

const pours: Pour[] = [
  {
    id: 'mock-pour-1',
    bottleId: eagleRare.id,
    date: daysAgo(1),
    ounces: 1.5,
    rating: 9.2,
    occasion: 'Porch time',
    companion: 'Dad',
    pouredWith: [{ personId: dad.id, name: dad.name }],
    location: 'Back porch',
    mood: 'Relaxed',
    memory: 'Caught up with Dad after a long week. This bottle never disappoints.',
    wouldBuyAgain: true,
    fip: {
      nose: 2.3,
      palate: 3.3,
      finish: 1.9,
      complexity: 0.9,
      value: 0.8,
      total: 9.2,
      noseAromas: ['Caramel', 'Vanilla'],
      palateFlavors: ['Oak', 'Toffee'],
    },
  },
  {
    id: 'mock-pour-2',
    bottleId: eagleRare.id,
    date: daysAgo(15),
    rating: 8.5,
    occasion: 'Firehouse gathering',
    companion: 'Mike',
    pouredWith: [{ personId: mike.id, name: mike.name }],
    fip: {
      nose: 2.1,
      palate: 3.0,
      finish: 1.7,
      complexity: 0.8,
      value: 0.9,
      total: 8.5,
      noseAromas: ['Brown Sugar'],
      palateFlavors: ['Cinnamon'],
    },
  },
  {
    id: 'mock-pour-3',
    bottleId: wellerSpecial.id,
    date: daysAgo(10),
    rating: 8.8,
    occasion: 'Quiet evening',
    companion: 'Dad',
    memory: 'Wheated bourbons are growing on me.',
    fip: {
      nose: 2.2,
      palate: 3.2,
      finish: 1.8,
      complexity: 0.8,
      value: 0.8,
      total: 8.8,
      noseAromas: ['Honey'],
      palateFlavors: ['Vanilla', 'Caramel'],
    },
  },
  {
    id: 'mock-pour-4',
    bottleId: blantons.id,
    date: daysAgo(40),
    rating: 9.6,
    occasion: 'Anniversary',
    companion: 'Sarah',
    memory: 'Shared this to celebrate our anniversary. Unforgettable.',
    wouldBuyAgain: true,
    fip: {
      nose: 2.4,
      palate: 3.4,
      finish: 2.0,
      complexity: 1.0,
      value: 0.8,
      total: 9.6,
      noseAromas: ['Cherry', 'Oak'],
      palateFlavors: ['Leather', 'Baking Spice'],
    },
  },
  {
    id: 'mock-pour-5',
    bottleId: oldGrandDad.id,
    date: daysAgo(115),
    rating: 6.5,
    occasion: 'Routine call',
    companion: 'Dad',
    fip: {
      nose: 1.5,
      palate: 2.3,
      finish: 1.2,
      complexity: 0.7,
      value: 0.8,
      total: 6.5,
      noseAromas: [],
      palateFlavors: [],
    },
  },
]

const memories: Memory[] = [
  {
    id: 'mock-memory-1',
    title: "Dad's retirement toast",
    date: daysAgo(40),
    location: 'Back porch',
    people: ['Dad', 'Mike'],
    bottleId: blantons.id,
    occasion: 'Retirement',
    story: 'Poured Blanton\'s to celebrate 30 years on the job. Dad told the story of his first call for the hundredth time — never gets old.',
    createdAt: Date.now() - 40 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-memory-2',
    title: 'Anniversary at home',
    date: daysAgo(40),
    people: ['Sarah'],
    bottleId: blantons.id,
    occasion: 'Anniversary',
    story: 'Stayed in and shared a pour instead of going out. Turned out better than any restaurant reservation would have.',
    createdAt: Date.now() - 40 * 24 * 60 * 60 * 1000,
  },
]

const backdraftBatch: InfinityBottle = {
  id: 'mock-infinity-backdraft',
  name: 'Backdraft Batch',
  capacityMl: 1000,
  archived: false,
  createdAt: Date.now() - 55 * 24 * 60 * 60 * 1000,
  batches: [
    {
      id: 'mock-infinity-backdraft-batch-1',
      name: 'First Due',
      goal: 'smoother',
      status: 'active',
      startedAt: Date.now() - 24 * 24 * 60 * 60 * 1000,
      additions: [
        {
          id: 'mock-addition-1',
          sourceBottleId: elmerTLee.id,
          bottleName: elmerTLee.name,
          proof: elmerTLee.proof,
          amountMl: 120,
          date: daysAgo(24),
          note: 'Started the blend with what was left of this one.',
          createdAt: Date.now() - 24 * 24 * 60 * 60 * 1000,
        },
        {
          id: 'mock-addition-2',
          sourceBottleId: oldGrandDad.id,
          bottleName: oldGrandDad.name,
          proof: oldGrandDad.proof,
          amountMl: 90,
          date: daysAgo(16),
          note: 'Wanted a little more spice.',
          createdAt: Date.now() - 16 * 24 * 60 * 60 * 1000,
        },
        {
          id: 'mock-addition-3',
          sourceBottleId: wellerSpecial.id,
          bottleName: wellerSpecial.name,
          proof: wellerSpecial.proof,
          amountMl: 60,
          date: daysAgo(8),
          note: 'Softening it back out.',
          createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
        },
        {
          id: 'mock-addition-4',
          sourceBottleId: eagleRare.id,
          bottleName: eagleRare.name,
          proof: eagleRare.proof,
          amountMl: 45,
          date: daysAgo(1),
          createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
        },
      ],
      tastings: [
        {
          id: 'mock-ib-tasting-1',
          date: daysAgo(15),
          score: 8.2,
          noseAromas: ['Caramel', 'Vanilla', 'Oak'],
          palateFlavors: ['Caramel', 'Cinnamon'],
          overallNotes: 'Off to a good start — needs a bit more spice to round it out.',
          createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
        },
        {
          id: 'mock-ib-tasting-2',
          date: daysAgo(7),
          score: 8.7,
          noseAromas: ['Caramel', 'Vanilla', 'Oak', 'Toast'],
          palateFlavors: ['Caramel', 'Baking Spice', 'Cherry'],
          finishNotes: 'Medium-long, warm, oak, butterscotch.',
          overallNotes: 'Really liking where this is headed. Well balanced with great depth.',
          companion: 'Dad',
          createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
        },
      ],
    },
  ],
}

const houseBlend1: InfinityBottle = {
  id: 'mock-infinity-house-blend',
  name: 'House Blend #1',
  capacityMl: 900,
  archived: false,
  createdAt: Date.now() - 200 * 24 * 60 * 60 * 1000,
  batches: [
    {
      id: 'mock-infinity-house-blend-batch-1',
      status: 'complete',
      startedAt: Date.now() - 200 * 24 * 60 * 60 * 1000,
      completedAt: Date.now() - 40 * 24 * 60 * 60 * 1000,
      additions: [
        {
          id: 'mock-addition-5',
          bottleName: 'Buffalo Trace',
          amountMl: 900,
          date: daysAgo(180),
          createdAt: Date.now() - 180 * 24 * 60 * 60 * 1000,
        },
      ],
      tastings: [
        {
          id: 'mock-ib-tasting-3',
          date: daysAgo(41),
          score: 9.0,
          noseAromas: ['Caramel'],
          palateFlavors: ['Vanilla'],
          overallNotes: 'Bottle finished — a good house pour the whole way through.',
          createdAt: Date.now() - 41 * 24 * 60 * 60 * 1000,
        },
      ],
    },
  ],
}

export const MOCK_USER_DOC: UserDoc = {
  username: 'devpreview',
  greetingName: 'Dev',
  bottles: [eagleRare, wellerSpecial, blantons, pappy15, fourRoses, oldGrandDad, elmerTLee],
  pours,
  memories,
  infinityBottles: [backdraftBatch, houseBlend1],
  customLibrary: [],
  people,
}
