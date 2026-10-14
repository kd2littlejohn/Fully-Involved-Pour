import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JoinPartyPage } from './JoinPartyPage'
import type { PartyPreview } from '../../features/party/types'

const mockNavigate = vi.fn()
const mockEnsureIdentity = vi.fn()
const mockPreview = vi.fn()
const mockJoin = vi.fn()
const mockRecover = vi.fn()
let identity: { user: { uid: string } | null; loading: boolean }

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})
vi.mock('../../features/party/useGuestIdentity', () => ({
  useGuestIdentity: () => ({ ...identity, ensureIdentity: mockEnsureIdentity }),
}))
vi.mock('../../data/repositories/party', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/repositories/party')>()
  return {
    ...actual,
    previewParty: (...a: unknown[]) => mockPreview(...a),
    joinParty: (...a: unknown[]) => mockJoin(...a),
    recoverGuest: (...a: unknown[]) => mockRecover(...a),
  }
})

const preview: PartyPreview = {
  partyId: 'p1', name: 'Bourbon Night', description: 'Bring a friend', eventDate: null, coverImageUrl: '', hostName: 'Kevin',
  status: 'live', categoryCount: 3, joinBlocker: null, guest: null, isHost: false,
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/p" element={<JoinPartyPage />} />
        <Route path="/p/:code" element={<JoinPartyPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('JoinPartyPage (QR / invite link)', () => {
  beforeEach(() => {
    identity = { user: null, loading: false }
    localStorage.clear()
    for (const m of [mockNavigate, mockEnsureIdentity, mockPreview, mockJoin, mockRecover]) m.mockReset()
    mockEnsureIdentity.mockResolvedValue({ uid: 'anon-1' })
    mockPreview.mockResolvedValue(preview)
  })

  it('joins with just a nickname — no email or password — and shows the recovery code', async () => {
    mockJoin.mockResolvedValue({ partyId: 'p1', nickname: 'Sam', recoveryCode: 'ABCDE-FGHJK', alreadyJoined: false })
    renderAt('/p/oak742')
    expect(await screen.findByRole('heading', { name: 'Bourbon Night' })).toBeInTheDocument()
    expect(mockPreview).toHaveBeenCalledWith('OAK742')
    expect(screen.queryByLabelText(/email|password/i)).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Your nickname'), 'Sam')
    await userEvent.click(screen.getByRole('button', { name: 'Join Party' }))
    expect(mockEnsureIdentity).toHaveBeenCalled()
    expect(mockJoin).toHaveBeenCalledWith('OAK742', 'Sam')
    expect(await screen.findByText('ABCDE-FGHJK')).toBeInTheDocument()
    expect(localStorage.getItem('fip.party.recovery.p1')).toBe('ABCDE-FGHJK')
    await userEvent.click(screen.getByRole('button', { name: 'Let’s taste' }))
    expect(mockNavigate).toHaveBeenCalledWith('/party/p1', { replace: true })
  })

  it('explains an invalid or expired code', async () => {
    mockPreview.mockRejectedValue({ code: 'functions/not-found', message: 'That party code doesn’t match an active party.' })
    renderAt('/p/ZZZZZZ')
    expect(await screen.findByRole('alert')).toHaveTextContent('doesn’t match an active party')
  })

  it('shows the server’s reason when joining is blocked and offers recovery', async () => {
    mockPreview.mockResolvedValue({ ...preview, joinBlocker: 'This invitation has expired.' })
    renderAt('/p/OAK742')
    expect(await screen.findByText('This invitation has expired.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Your nickname')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /recovery code/ }))
    mockRecover.mockResolvedValue({ partyId: 'p1', recovered: true, nickname: 'Sam', recoveryCode: 'NEWCO-DE234' })
    await userEvent.type(screen.getByLabelText('Recovery code'), 'abcde-fghjk')
    await userEvent.click(screen.getByRole('button', { name: 'Rejoin' }))
    await waitFor(() => expect(mockRecover).toHaveBeenCalledWith('OAK742', 'ABCDE-FGHJK'))
    expect(await screen.findByText('NEWCO-DE234')).toBeInTheDocument()
  })

  it('sends a returning guest straight back to the party', async () => {
    identity = { user: { uid: 'anon-1' }, loading: false }
    mockPreview.mockResolvedValue({ ...preview, guest: { nickname: 'Sam' } })
    renderAt('/p/OAK742')
    expect(await screen.findByText('Welcome back, Sam.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue to the party' })).toHaveAttribute('href', '/party/p1')
  })

  it('surfaces a duplicate nickname', async () => {
    mockJoin.mockRejectedValue({ code: 'functions/already-exists', message: 'Someone already joined with that nickname.' })
    renderAt('/p/OAK742')
    await userEvent.type(await screen.findByLabelText('Your nickname'), 'Sam')
    await userEvent.click(screen.getByRole('button', { name: 'Join Party' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already joined with that nickname')
  })
})
