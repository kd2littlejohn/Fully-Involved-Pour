import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { RarityReviewPage } from './RarityReviewPage'
import { rarityIdentity, rarityIdentityKey } from '../../data/repositories/rarity'
import type { Bottle, RaritySuggestion } from '../../data/types'

const mockUseAuth = vi.fn()
const mockUseUserData = vi.fn()
const mockAcceptRaritySuggestions = vi.fn().mockResolvedValue(undefined)
const mockStoreRaritySuggestions = vi.fn().mockResolvedValue(undefined)
const mockSetBottleRarity = vi.fn().mockResolvedValue(undefined)
const mockRequestRaritySuggestion = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

vi.mock('../../data/repositories/rarity', async () => {
  const actual = await vi.importActual<typeof import('../../data/repositories/rarity')>('../../data/repositories/rarity')
  return { ...actual, requestRaritySuggestion: (...args: unknown[]) => mockRequestRaritySuggestion(...args) }
})

function renderPage() {
  return render(
    <MemoryRouter>
      <RarityReviewPage />
    </MemoryRouter>,
  )
}

function baseUserData(bottles: Bottle[]) {
  return {
    userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
    loading: false,
    acceptRaritySuggestions: mockAcceptRaritySuggestions,
    storeRaritySuggestions: mockStoreRaritySuggestions,
    setBottleRarity: mockSetBottleRarity,
  }
}

// A pending suggestion the review page will treat as already-valid for the
// given bottle (real identityKey computed the same way the component
// does) — matches the resumed-run scenario without needing a network call.
function suggestionFor(bottle: Pick<Bottle, 'name' | 'distillery' | 'type'>, overrides: Partial<RaritySuggestion> = {}): RaritySuggestion {
  return {
    rarity: 'rare',
    confidence: 'high',
    reason: 'x',
    identityKey: rarityIdentityKey(rarityIdentity(bottle)),
    generatedAt: 1,
    classifierVersion: 'rarity-v2',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAcceptRaritySuggestions.mockResolvedValue(undefined)
  mockStoreRaritySuggestions.mockResolvedValue(undefined)
  mockSetBottleRarity.mockResolvedValue(undefined)
  mockUseAuth.mockReturnValue({ user: { uid: 'u1' }, loading: false })
})

describe('RarityReviewPage', () => {
  it('shows "nothing to review" when every owned bottle already has a confirmed rarity', () => {
    mockUseUserData.mockReturnValue(baseUserData([{ id: 'b1', name: 'Eagle Rare', status: 'open', createdAt: 1, rarity: 'rare', raritySource: 'manual' }]))
    renderPage()
    expect(screen.getByText('Nothing to review.')).toBeInTheDocument()
  })

  it('excludes wishlist/incoming and already-confirmed bottles from the review queue', () => {
    mockUseUserData.mockReturnValue(
      baseUserData([
        { id: 'b1', name: 'Wishlist Bottle', status: 'wishlist', createdAt: 1 },
        { id: 'b2', name: 'Manual Bottle', status: 'open', createdAt: 2, rarity: 'common', raritySource: 'manual' },
        { id: 'b3', name: 'Eligible Bottle', status: 'open', createdAt: 3 },
      ]),
    )
    mockRequestRaritySuggestion.mockResolvedValue({ status: 'ready', suggestion: { rarity: null, confidence: 'low', reason: 'x', identityKey: 'k', generatedAt: 1, classifierVersion: 'v1' } })
    renderPage()
    expect(screen.getByText('Eligible Bottle')).toBeInTheDocument()
    expect(screen.queryByText('Wishlist Bottle')).not.toBeInTheDocument()
    expect(screen.queryByText('Manual Bottle')).not.toBeInTheDocument()
  })

  it('a bottle with an already-valid suggestion renders immediately with zero network calls (resume behavior)', () => {
    const bottle: Bottle = { id: 'b1', name: 'Already Suggested', status: 'open', createdAt: 1 }
    bottle.raritySuggestion = suggestionFor(bottle, { rarity: 'rare', reason: 'Usually via lottery.' })
    mockUseUserData.mockReturnValue(baseUserData([bottle]))
    renderPage()
    expect(screen.getByText('Already Suggested')).toBeInTheDocument()
    expect(screen.getByText('Usually via lottery.')).toBeInTheDocument()
    expect(mockRequestRaritySuggestion).not.toHaveBeenCalled()
  })

  it('Accept All only affects High-confidence suggestions; Medium/Low still require individual review', async () => {
    const high: Bottle = { id: 'b1', name: 'High Bottle', status: 'open', createdAt: 1 }
    high.raritySuggestion = suggestionFor(high, { confidence: 'high' })
    const medium: Bottle = { id: 'b2', name: 'Medium Bottle', status: 'open', createdAt: 2 }
    medium.raritySuggestion = suggestionFor(medium, { confidence: 'medium' })
    mockUseUserData.mockReturnValue(baseUserData([high, medium]))
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Accept All High-Confidence Suggestions \(1\)/ }))
    await user.click(screen.getByRole('button', { name: 'Accept All' }))

    expect(mockAcceptRaritySuggestions).toHaveBeenCalledWith(['b1'])
    expect(mockAcceptRaritySuggestions).not.toHaveBeenCalledWith(expect.arrayContaining(['b2']))
    // Medium Bottle's own row is still present, still individually actionable.
    expect(screen.getByText('Medium Bottle')).toBeInTheDocument()
  })

  it('"Leave Unclassified" removes the row from the current session without writing anything', async () => {
    const bottle: Bottle = { id: 'b1', name: 'Skip Me', status: 'open', createdAt: 1 }
    bottle.raritySuggestion = suggestionFor(bottle)
    mockUseUserData.mockReturnValue(baseUserData([bottle]))
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Leave Unclassified' }))
    expect(screen.queryByText('Skip Me')).not.toBeInTheDocument()
    expect(mockAcceptRaritySuggestions).not.toHaveBeenCalled()
    expect(mockSetBottleRarity).not.toHaveBeenCalled()
  })

  it('accepting one bottle calls acceptRaritySuggestions with just that id', async () => {
    const bottle: Bottle = { id: 'b1', name: 'Accept Me', status: 'open', createdAt: 1 }
    bottle.raritySuggestion = suggestionFor(bottle)
    mockUseUserData.mockReturnValue(baseUserData([bottle]))
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Accept Suggestion' }))
    expect(mockAcceptRaritySuggestions).toHaveBeenCalledWith(['b1'])
  })

  it('choosing a different rarity for a row calls setBottleRarity with that bottle', async () => {
    mockUseUserData.mockReturnValue(baseUserData([{ id: 'b1', name: 'Change Me', status: 'open', createdAt: 1 }]))
    mockRequestRaritySuggestion.mockResolvedValue({ status: 'ready', suggestion: { rarity: null, confidence: 'low', reason: 'x', identityKey: 'k', generatedAt: 1, classifierVersion: 'v1' } })
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Change' }))
    await user.click(screen.getByRole('button', { name: 'Rare' }))
    expect(mockSetBottleRarity).toHaveBeenCalledWith('b1', 'rare')
  })

  it('fetches suggestions for bottles that need one, in controlled concurrency, and persists each as it resolves', async () => {
    mockUseUserData.mockReturnValue(
      baseUserData([
        { id: 'b1', name: 'Needs Fetch 1', status: 'open', createdAt: 1 },
        { id: 'b2', name: 'Needs Fetch 2', status: 'open', createdAt: 2 },
      ]),
    )
    mockRequestRaritySuggestion.mockResolvedValue({ status: 'ready', suggestion: { rarity: 'common', confidence: 'high', reason: 'x', identityKey: 'k', generatedAt: 1, classifierVersion: 'v1' } })
    renderPage()
    await waitFor(() => expect(mockRequestRaritySuggestion).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(mockStoreRaritySuggestions).toHaveBeenCalled())
  })

  it('a failed fetch shows the partial-failure footer without blocking the rest of the run', async () => {
    mockUseUserData.mockReturnValue(baseUserData([{ id: 'b1', name: 'Fails', status: 'open', createdAt: 1 }]))
    mockRequestRaritySuggestion.mockResolvedValue({ status: 'failed' })
    renderPage()
    await waitFor(() => expect(screen.getByText('Some bottles could not be classified.')).toBeInTheDocument())
  })
})
