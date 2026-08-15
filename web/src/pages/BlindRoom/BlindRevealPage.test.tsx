import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BlindRevealPage } from './BlindRevealPage'
import type { BlindParticipant, BlindRoom } from '../../data/types'

const mockUseAuth = vi.fn()
const mockNavigate = vi.fn()
const mockUseBlindRoom = vi.fn()
const mockGetBlindRoomSecrets = vi.fn()
const mockGetAllParticipantResponses = vi.fn()
const mockGetAllFinalRankings = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('../../hooks/useBlindRoom', () => ({
  useBlindRoom: (...args: unknown[]) => mockUseBlindRoom(...args),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../data/repositories/blindRoom', () => ({
  getBlindRoomSecrets: (...args: unknown[]) => mockGetBlindRoomSecrets(...args),
  getAllParticipantResponses: (...args: unknown[]) => mockGetAllParticipantResponses(...args),
  getAllFinalRankings: (...args: unknown[]) => mockGetAllFinalRankings(...args),
}))

const room: BlindRoom = {
  id: 'room-1',
  code: 'OAK742',
  name: 'Friday Night Blind',
  hostUid: 'host-1',
  hostUsername: 'kevin',
  sessionType: 'live',
  knowledgeMode: 'single',
  pourCount: 2,
  state: 'revealed',
  createdAt: Date.now(),
  participantCount: 2,
}

const host: BlindParticipant = { uid: 'host-1', username: 'kevin', isHost: true, status: 'completed', joinedAt: Date.now() }
const guest: BlindParticipant = { uid: 'guest-1', username: 'marcus', isHost: false, status: 'completed', joinedAt: Date.now() }

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/blind/room-1/reveal']}>
      <Routes>
        <Route path="/blind/:roomId/reveal" element={<BlindRevealPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('BlindRevealPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: { uid: 'host-1' }, loading: false })
    mockGetBlindRoomSecrets.mockResolvedValue({
      roomId: 'room-1',
      pours: [
        { label: 'A', bottleId: 'b1', bottleName: 'Stagg Jr.', distillery: 'Buffalo Trace', proof: 128 },
        { label: 'B', bottleId: 'b2', bottleName: 'Eagle Rare 10 Year', distillery: 'Buffalo Trace', proof: 90 },
      ],
    })
    mockGetAllParticipantResponses.mockResolvedValue({
      'host-1': [{ pourLabel: 'A', reaction: 'Love It', fipScore: 9.3, status: 'locked', updatedAt: Date.now() }],
      'guest-1': [{ pourLabel: 'A', reaction: 'Just Okay', fipScore: 6.0, status: 'locked', updatedAt: Date.now() }],
    })
    mockGetAllFinalRankings.mockResolvedValue({
      'host-1': { order: ['A', 'B'], status: 'locked', updatedAt: Date.now() },
      'guest-1': { order: ['B', 'A'], status: 'locked', updatedAt: Date.now() },
    })
  })

  it('shows each pour’s real bottle identity and every participant’s reaction/score once revealed', async () => {
    mockUseBlindRoom.mockReturnValue({ room, participants: [host, guest], loading: false, refresh: vi.fn() })
    renderPage()

    expect((await screen.findAllByText('Stagg Jr.')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Eagle Rare 10 Year').length).toBeGreaterThan(0)
    expect(screen.getByText('Buffalo Trace · 128 proof')).toBeInTheDocument()
    expect(screen.getByText('Love It')).toBeInTheDocument()
    expect(screen.getByText('9.3')).toBeInTheDocument()
    expect(screen.getByText('Just Okay')).toBeInTheDocument()
  })

  it('shows each participant’s final ranking translated to real bottle names', async () => {
    mockUseBlindRoom.mockReturnValue({ room, participants: [host, guest], loading: false, refresh: vi.fn() })
    renderPage()

    const heading = await screen.findByText('Everyone’s Rankings')
    const section = heading.closest('div')!
    const kevinCard = within(section).getByText('kevin').closest('div')!
    expect(kevinCard.textContent).toContain('Stagg Jr.')
  })

  it('shows Your Ranking with the signed-in viewer’s own score per item', async () => {
    mockUseBlindRoom.mockReturnValue({ room, participants: [host, guest], loading: false, refresh: vi.fn() })
    renderPage()

    const heading = await screen.findByText('Your Ranking')
    const section = heading.closest('div')!
    expect(section.textContent).toContain('Stagg Jr. — 9.3')
  })

  it('shows The Numbers with group ranking, average scores, and a biggest surprise when the score leader and rank leader differ', async () => {
    mockGetAllParticipantResponses.mockResolvedValue({
      'host-1': [
        { pourLabel: 'A', fipScore: 9.5, status: 'locked', updatedAt: Date.now() },
        { pourLabel: 'B', fipScore: 8.0, status: 'locked', updatedAt: Date.now() },
      ],
      'guest-1': [
        { pourLabel: 'A', fipScore: 9.5, status: 'locked', updatedAt: Date.now() },
        { pourLabel: 'B', fipScore: 5.0, status: 'locked', updatedAt: Date.now() },
      ],
    })
    mockGetAllFinalRankings.mockResolvedValue({
      'host-1': { order: ['B', 'A'], status: 'locked', updatedAt: Date.now() },
      'guest-1': { order: ['B', 'A'], status: 'locked', updatedAt: Date.now() },
    })
    mockUseBlindRoom.mockReturnValue({ room, participants: [host, guest], loading: false, refresh: vi.fn() })
    renderPage()

    expect(await screen.findByText('The Numbers')).toBeInTheDocument()
    expect(screen.getByText('Group Ranking')).toBeInTheDocument()
    expect(screen.getByText('Group Average Scores')).toBeInTheDocument()
    expect(screen.getByText(/Most divisive:/)).toBeInTheDocument()
    expect(screen.getByText(/Biggest surprise:/)).toBeInTheDocument()
  })

  it('hides group-only sections for a solo reveal, but still shows Your Ranking and Closest Matchup', async () => {
    mockGetAllParticipantResponses.mockResolvedValue({
      'host-1': [
        { pourLabel: 'A', fipScore: 9.2, status: 'locked', updatedAt: Date.now() },
        { pourLabel: 'B', fipScore: 8.8, status: 'locked', updatedAt: Date.now() },
      ],
    })
    mockGetAllFinalRankings.mockResolvedValue({
      'host-1': { order: ['A', 'B'], status: 'locked', updatedAt: Date.now() },
    })
    mockUseBlindRoom.mockReturnValue({
      room: { ...room, sessionType: 'solo' },
      participants: [host],
      loading: false,
      refresh: vi.fn(),
    })
    renderPage()

    expect(await screen.findByText('Your Ranking')).toBeInTheDocument()
    expect(screen.queryByText('Everyone’s Rankings')).not.toBeInTheDocument()
    expect(screen.queryByText('Group Ranking')).not.toBeInTheDocument()
    expect(screen.queryByText('Group Average Scores')).not.toBeInTheDocument()
    expect(screen.queryByText(/Most divisive:/)).not.toBeInTheDocument()
    expect(screen.getByText(/Closest matchup:/)).toBeInTheDocument()
  })

  it('does not fetch or show results before the room has been revealed', () => {
    mockUseBlindRoom.mockReturnValue({ room: { ...room, state: 'active' }, participants: [host, guest], loading: false, refresh: vi.fn() })
    renderPage()

    expect(screen.getByText('Not revealed yet.')).toBeInTheDocument()
    expect(mockGetBlindRoomSecrets).not.toHaveBeenCalled()
  })

  it('shows an empty state when the room cannot be found', () => {
    mockUseBlindRoom.mockReturnValue({ room: undefined, participants: [], loading: false, refresh: vi.fn() })
    renderPage()

    expect(screen.getByText('We couldn’t find this Blind Room.')).toBeInTheDocument()
  })
})
