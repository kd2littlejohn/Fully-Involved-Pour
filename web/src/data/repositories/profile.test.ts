import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockIsMockAuthEnabled = vi.fn()
vi.mock('../devMode', () => ({
  isMockAuthEnabled: () => mockIsMockAuthEnabled(),
}))

vi.mock('../firebase', () => ({ db: {} }))

const mockCollection = vi.fn((...args: unknown[]) => ({ __type: 'collection', args }))
const mockDoc = vi.fn((...args: unknown[]) => ({ __type: 'doc', args }))
const mockOrderBy = vi.fn((...args: unknown[]) => ({ __type: 'orderBy', args }))
const mockStartAt = vi.fn((...args: unknown[]) => ({ __type: 'startAt', args }))
const mockEndAt = vi.fn((...args: unknown[]) => ({ __type: 'endAt', args }))
const mockQuery = vi.fn((...args: unknown[]) => ({ __type: 'query', args }))
const mockGetDoc = vi.fn()
const mockGetDocs = vi.fn()
const mockSetDoc = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  endAt: (...args: unknown[]) => mockEndAt(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  startAt: (...args: unknown[]) => mockStartAt(...args),
}))

vi.mock('../mockSocialData', () => ({
  MOCK_FRIEND_PROFILES: [
    {
      uid: 'friend-1',
      username: 'Pour_Teknique',
      displayName: 'Kevin Littlejohn',
      location: 'Cincinnati, OH',
      whiskeyIdentityTags: ['Bourbon'],
    },
    { uid: 'friend-2', username: 'other_user', displayName: 'Someone Else' },
  ],
}))

import { ensureSearchableProfile, saveProfile, searchProfiles } from './profile'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('searchProfiles — mock mode (validates the normalization pipeline end to end)', () => {
  beforeEach(() => {
    mockIsMockAuthEnabled.mockReturnValue(true)
  })

  it.each([
    'Kevin',
    'kevin littlejohn',
    'Pour_Teknique',
    'pour_teknique',
    '@Pour_Teknique',
    'pour_tek',
  ])('finds Kevin Littlejohn / @Pour_Teknique when searching %j', async (rawQuery) => {
    const results = await searchProfiles(rawQuery)
    expect(results.map((r) => r.uid)).toContain('friend-1')
  })

  it('excludes the viewer from their own search results', async () => {
    const results = await searchProfiles('Kevin', 'friend-1')
    expect(results.map((r) => r.uid)).not.toContain('friend-1')
  })

  it('returns nothing for a query that matches no one', async () => {
    const results = await searchProfiles('zzz-nobody-has-this-name')
    expect(results).toHaveLength(0)
  })

  it('returns nothing for an empty or whitespace-only query, without querying at all', async () => {
    expect(await searchProfiles('   ')).toEqual([])
  })
})

describe('searchProfiles — real Firestore path (query construction)', () => {
  beforeEach(() => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    mockGetDocs.mockResolvedValue({ docs: [] })
  })

  it('builds a prefix range, not an exact-match range, on both normalized fields', async () => {
    await searchProfiles('Kevin')

    expect(mockStartAt).toHaveBeenCalledWith('kevin')
    expect(mockOrderBy).toHaveBeenCalledWith('normalizedUsername')
    expect(mockOrderBy).toHaveBeenCalledWith('normalizedDisplayName')

    // This is the regression guard for the exact bug this task fixed:
    // endAt must never be called with the bare normalized query, since
    // startAt(q).endAt(q) collapses the range to an exact-match query.
    const endAtValues = mockEndAt.mock.calls.map((call) => call[0] as string)
    expect(endAtValues.length).toBeGreaterThan(0)
    for (const value of endAtValues) {
      expect(value).not.toBe('kevin')
      expect(value.startsWith('kevin')).toBe(true)
      expect(value.length).toBeGreaterThan('kevin'.length)
    }
  })

  it('trims, strips a leading @, and lowercases the query before building the range', async () => {
    await searchProfiles('  @Pour_Teknique  ')
    expect(mockStartAt).toHaveBeenCalledWith('pour_teknique')
  })

  it('merges username and display-name matches without duplicates, and excludes excludeUid', async () => {
    mockGetDocs
      .mockResolvedValueOnce({
        docs: [{ id: 'friend-1', data: () => ({ username: 'kevin', displayName: 'Kevin' }) }],
      })
      .mockResolvedValueOnce({
        docs: [
          { id: 'friend-1', data: () => ({ username: 'kevin', displayName: 'Kevin' }) },
          { id: 'friend-2', data: () => ({ username: 'kev2', displayName: 'Kevin Two' }) },
        ],
      })

    const results = await searchProfiles('kev', 'friend-2')
    expect(results.map((r) => r.uid).sort()).toEqual(['friend-1'])
  })

  it('logs and rethrows a Firestore error rather than swallowing it', async () => {
    const err = Object.assign(new Error('permission denied'), { code: 'permission-denied' })
    mockGetDocs.mockReset()
    mockGetDocs.mockRejectedValue(err)

    await expect(searchProfiles('kevin')).rejects.toThrow('permission denied')
  })
})

describe('saveProfile', () => {
  beforeEach(() => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    mockSetDoc.mockResolvedValue(undefined)
  })

  it('keeps normalizedDisplayName in sync whenever displayName is part of the patch', async () => {
    await saveProfile('uid-1', { displayName: '  Kevin Littlejohn  ' })
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ displayName: '  Kevin Littlejohn  ', normalizedDisplayName: 'kevin littlejohn' }),
      { merge: true },
    )
  })

  it('does not touch normalizedDisplayName when displayName is not part of the patch', async () => {
    await saveProfile('uid-1', { bio: 'Bourbon enthusiast' })
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), { bio: 'Bourbon enthusiast' }, { merge: true })
  })
})

describe('ensureSearchableProfile', () => {
  beforeEach(() => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    mockSetDoc.mockResolvedValue(undefined)
  })

  function usernameDocCandidates(): string[] {
    return mockDoc.mock.calls.filter((call) => call[1] === 'usernames').map((call) => call[2] as string)
  }

  it('no-ops (no read, no write) when the existing profile is already fully searchable', async () => {
    const profile = { username: 'kevin', normalizedUsername: 'kevin', displayName: 'Kevin', normalizedDisplayName: 'kevin' }

    const result = await ensureSearchableProfile('uid-1', profile, { displayName: 'Kevin' })

    expect(result).toBe(profile)
    expect(mockGetDoc).not.toHaveBeenCalled()
    expect(mockSetDoc).not.toHaveBeenCalled()
  })

  // This is the actual bug reported in production: an account whose
  // profiles/{uid} doc genuinely exists (username really is claimed) but
  // predates normalizedUsername/normalizedDisplayName, or whose claim write
  // only partially landed, was previously treated as "already has a
  // profile, nothing to do" and stayed permanently unfindable.
  it('repairs a profile that exists but is missing normalizedUsername, in place', async () => {
    const profile = { username: 'captainpouralot', displayName: 'Captain Pour-a-lot' }

    const result = await ensureSearchableProfile('uid-1', profile, {})

    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      { normalizedUsername: 'captainpouralot', normalizedDisplayName: 'captain pour-a-lot' },
      { merge: true },
    )
    expect(result).toEqual({
      username: 'captainpouralot',
      displayName: 'Captain Pour-a-lot',
      normalizedUsername: 'captainpouralot',
      normalizedDisplayName: 'captain pour-a-lot',
    })
  })

  it('repairs a stale normalizedUsername that no longer matches username', async () => {
    const profile = { username: 'newname', normalizedUsername: 'oldname' }

    const result = await ensureSearchableProfile('uid-1', profile, {})

    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), { normalizedUsername: 'newname' }, { merge: true })
    expect(result?.normalizedUsername).toBe('newname')
  })

  // This is the real production bug: an account whose Profile page correctly
  // shows "@captainpouralot" (read from the private userDoc.username field)
  // can still have a profiles/{uid} doc that only ever got displayName
  // written to it — e.g. from an Edit Profile save that touched displayName/
  // bio/location without ever going through the separate username-claim
  // flow. The doc existing (with a username field present, previously the
  // only check) is not the same as it being findable.
  it('claims a username onto an existing profile that has other fields but no username at all', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false }) // usernames/captainpouralot check
    const profile = { displayName: 'Captain Pour-a-lot', normalizedDisplayName: 'captain pour-a-lot' }

    const result = await ensureSearchableProfile('uid-1', profile, { preferredUsername: 'captainpouralot' })

    expect(usernameDocCandidates()).toEqual(['captainpouralot'])
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), { uid: 'uid-1', username: 'captainpouralot' })
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      {
        username: 'captainpouralot',
        normalizedUsername: 'captainpouralot',
        displayName: 'Captain Pour-a-lot',
        normalizedDisplayName: 'captain pour-a-lot',
      },
      { merge: true },
    )
    expect(result).toEqual({
      displayName: 'Captain Pour-a-lot',
      normalizedDisplayName: 'captain pour-a-lot',
      username: 'captainpouralot',
      normalizedUsername: 'captainpouralot',
    })
  })

  it('derives the missing username from the profile’s own displayName when there is no preferredUsername hint', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false })
    const profile = { displayName: 'Captain Pour-a-lot' }

    await ensureSearchableProfile('uid-1', profile, {})

    expect(usernameDocCandidates()).toEqual(['captain_pour_a_lot'])
  })

  it('creates usernames/{slug} and profiles/{uid} from the display name when no profile exists yet', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false }) // usernames/{candidate} check

    const result = await ensureSearchableProfile('uid-1', undefined, {
      displayName: 'Kevin Littlejohn',
      photoURL: 'https://example.com/p.jpg',
    })

    expect(usernameDocCandidates()).toEqual(['kevin_littlejohn'])
    expect(mockSetDoc).toHaveBeenCalledWith(expect.anything(), { uid: 'uid-1', username: 'kevin_littlejohn' })
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      {
        username: 'kevin_littlejohn',
        normalizedUsername: 'kevin_littlejohn',
        displayName: 'Kevin Littlejohn',
        normalizedDisplayName: 'kevin littlejohn',
        photoURL: 'https://example.com/p.jpg',
      },
      { merge: true },
    )
    expect(result?.username).toBe('kevin_littlejohn')
  })

  it('prefers an already-chosen private username over deriving one from the display name', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false })

    await ensureSearchableProfile('uid-1', undefined, { preferredUsername: '@Pour_Teknique', displayName: 'Kevin Littlejohn' })

    expect(usernameDocCandidates()).toEqual(['pour_teknique'])
  })

  it('retries with a numeric suffix when the derived username is already claimed by someone else', async () => {
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ uid: 'someone-else' }) }) // usernames/kevin taken
      .mockResolvedValueOnce({ exists: () => false }) // usernames/kevin2 free

    await ensureSearchableProfile('uid-1', undefined, { displayName: 'Kevin' })

    expect(usernameDocCandidates()).toEqual(['kevin', 'kevin2'])
  })

  it('reclaims a username it already owns from a previous partial attempt, instead of skipping it', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ uid: 'uid-1' }) }) // usernames/kevin already ours

    await ensureSearchableProfile('uid-1', undefined, { displayName: 'Kevin' })

    expect(usernameDocCandidates()).toEqual(['kevin'])
    expect(mockSetDoc).toHaveBeenCalled()
  })

  it('falls back to a friend_{uid} slug when there is no display name or preferred username to derive from', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false })

    await ensureSearchableProfile('abcdef123456', undefined, {})

    expect(usernameDocCandidates()).toEqual(['friend_abcdef'])
  })

  it('gives up after exhausting every attempt without throwing', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ uid: 'someone-else' }) })

    await expect(ensureSearchableProfile('uid-1', undefined, { displayName: 'Kevin' })).resolves.toBeUndefined()
    expect(mockSetDoc).not.toHaveBeenCalled()
  })

  it('is a no-op in mock/dev-fixture mode, returning the existing profile untouched', async () => {
    mockIsMockAuthEnabled.mockReturnValue(true)
    const profile = { username: 'kevin' }

    const result = await ensureSearchableProfile('uid-1', profile, { displayName: 'Kevin' })

    expect(result).toBe(profile)
    expect(mockGetDoc).not.toHaveBeenCalled()
    expect(mockSetDoc).not.toHaveBeenCalled()
  })
})
