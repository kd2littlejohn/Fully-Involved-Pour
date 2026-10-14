import { DEFAULT_PARTY_SETTINGS, type Party, type PartyCategory, type PartyCategoryResults } from '../types'

export function makeCategory(overrides: Partial<PartyCategory> = {}): PartyCategory {
  return {
    id: 'c1',
    libraryId: 'wheated-bourbon',
    name: 'Wheated Bourbon',
    description: '',
    state: 'voting_open',
    sampleLabels: ['A', 'B', 'C'],
    lockedAt: 1,
    votingOpenedAt: 1,
    votingClosedAt: null,
    revealedAt: null,
    createdAt: 1,
    ...overrides,
  }
}

export function makeParty(overrides: Partial<Party> = {}): Party {
  return {
    id: 'p1',
    hostUid: 'host-1',
    hostName: 'Kevin',
    name: 'Bourbon Night',
    description: '',
    eventDate: null,
    coverImageUrl: '',
    capacity: null,
    status: 'live',
    settings: { ...DEFAULT_PARTY_SETTINGS },
    categories: [makeCategory()],
    currentCategoryId: 'c1',
    joinCode: 'OAK742',
    inviteActive: true,
    inviteExpiresAt: null,
    counts: { guests: 3, digital: { c1: 2 }, paper: { c1: 1 } },
    createdAt: 1,
    updatedAt: 1,
    completedAt: null,
    ...overrides,
  }
}

export function makeResults(overrides: Partial<PartyCategoryResults> = {}): PartyCategoryResults {
  return {
    partyId: 'p1',
    categoryId: 'c1',
    name: 'Wheated Bourbon',
    description: '',
    samples: [
      { label: 'B', bottle: { name: 'Weller 12' }, average: 8, count: 3, rank: 1, favoriteVotes: 1, isChampion: true, isPeoplesChoice: false },
      { label: 'A', bottle: { name: 'Larceny' }, average: 8, count: 2, rank: 1, favoriteVotes: 2, isChampion: true, isPeoplesChoice: true },
      { label: 'C', bottle: { name: "Maker's Mark" }, average: null, count: 0, rank: null, favoriteVotes: 0, isChampion: false, isPeoplesChoice: false },
    ],
    champions: ['A', 'B'],
    peoplesChoice: ['A'],
    awards: [{ id: 'category-champion', title: 'Category Champion', labels: ['A', 'B'], detail: 'Tied for the highest average enjoyment.' }],
    ballotsCounted: 3,
    ratingsCounted: 5,
    guestScores: [
      { participantKey: 'g_me', name: 'Kev', source: 'digital', scores: { A: 9, B: 8 }, favoriteLabel: 'A' },
      { participantKey: 'p_1', name: 'Ballot 4', source: 'paper', scores: { B: 7 }, favoriteLabel: null },
    ],
    revealedAt: Date.now() - 120_000,
    ...overrides,
  }
}
