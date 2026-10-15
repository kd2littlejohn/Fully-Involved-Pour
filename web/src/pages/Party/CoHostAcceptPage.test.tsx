import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CoHostAcceptPage } from './CoHostAcceptPage'

const mockUseAuth = vi.fn()
const mockAccept = vi.fn()
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mockUseAuth() }))
vi.mock('../../hooks/useUserData', () => ({ useUserData: () => ({ profile: { displayName: 'Pat' } }) }))
vi.mock('../../components/domain/SignInButton', () => ({ SignInButton: () => <button type="button">Sign in</button> }))
vi.mock('../../data/repositories/party', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/repositories/party')>()
  return { ...actual, acceptCoHost: (...a: unknown[]) => mockAccept(...a) }
})

function renderPage(path = '/party/p1/cohost?t=TOKEN123') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/party/:partyId/cohost" element={<CoHostAcceptPage />} />
        <Route path="/party/:partyId/host" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CoHostAcceptPage', () => {
  beforeEach(() => {
    mockAccept.mockReset().mockResolvedValue({ partyId: 'p1', alreadyCoHost: false })
    mockUseAuth.mockReturnValue({ user: { uid: 'u2', displayName: 'Pat G' }, loading: false })
  })

  it('asks for an FIP sign-in first', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    renderPage()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(mockAccept).not.toHaveBeenCalled()
  })

  it('accepts with the token and opens the dashboard', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Become co-host' }))
    expect(mockAccept).toHaveBeenCalledWith('p1', 'TOKEN123', 'Pat')
    expect(await screen.findByText('Dashboard')).toBeInTheDocument()
  })

  it('shows the server’s reason when the link is used up', async () => {
    mockAccept.mockRejectedValueOnce({ code: 'functions/not-found', message: 'That co-host link isn’t valid or was already used.' })
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Become co-host' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('already used'))
  })

  it('handles a link without a token', () => {
    renderPage('/party/p1/cohost')
    expect(screen.getByText('Link incomplete')).toBeInTheDocument()
  })
})
