import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ScoringPanel } from './ScoringPanel'
import { makeCategory, makeParty } from './__fixtures__/party'
import type { PartyBallot } from './types'

const mockSaveBallot = vi.fn()
vi.mock('../../data/repositories/party', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/repositories/party')>()
  return { ...actual, saveBallot: (...args: unknown[]) => mockSaveBallot(...args) }
})

function ballot(overrides: Partial<PartyBallot> = {}): PartyBallot {
  return {
    id: 'c1__g1', partyId: 'p1', categoryId: 'c1', participantKey: 'g1', source: 'digital', ownerUid: 'u1', mode: 'quick',
    scores: {}, favoriteLabel: null, predictionLabel: null, excluded: false, createdAt: 1, updatedAt: 1, revision: 1, ...overrides,
  }
}

describe('ScoringPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    mockSaveBallot.mockReset()
    mockSaveBallot.mockImplementation(async (input: { scores: Record<string, unknown>; favoriteLabel: string | null }) => ({
      ballotId: 'c1__g1', scores: input.scores, favoriteLabel: input.favoriteLabel, predictionLabel: null, locked: false,
    }))
  })

  it('renders one card per actual sample (not an assumed three)', () => {
    render(<ScoringPanel party={makeParty()} category={makeCategory({ sampleLabels: ['A', 'B'] })} ballot={undefined} />)
    expect(screen.getByRole('heading', { name: 'Sample A' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sample B' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Sample C' })).not.toBeInTheDocument()
  })

  it('saves a Quick Score with the overall rating, descriptors and favorite', async () => {
    render(<ScoringPanel party={makeParty()} category={makeCategory()} ballot={undefined} />)
    fireEvent.change(screen.getByLabelText('Overall enjoyment', { selector: '#overall-A' }), { target: { value: '7.5' } })
    await userEvent.click(screen.getAllByRole('button', { name: 'Caramel' })[0]!)
    await userEvent.click(screen.getAllByRole('radio', { name: 'A' })[0]!)
    await userEvent.click(screen.getByRole('button', { name: 'Save sample A' }))
    await waitFor(() => expect(mockSaveBallot).toHaveBeenCalled())
    expect(mockSaveBallot.mock.calls[0]![0]).toMatchObject({
      partyId: 'p1', categoryId: 'c1', mode: 'quick',
      scores: { A: { overall: 7.5, descriptors: ['Caramel'] } },
      favoriteLabel: 'A',
    })
  })

  it('keeps everything when switching between Quick and Detailed', async () => {
    render(<ScoringPanel party={makeParty()} category={makeCategory()} ballot={undefined} />)
    fireEvent.change(screen.getByLabelText('Overall enjoyment', { selector: '#overall-B' }), { target: { value: '6' } })
    await userEvent.click(screen.getByRole('radio', { name: 'Detailed' }))
    fireEvent.change(screen.getByLabelText(/Nose/, { selector: '#nose-B' }), { target: { value: '8' } })
    await userEvent.type(screen.getByLabelText(/Tasting notes/, { selector: '#notes-B' }), 'Cherry cola')
    await userEvent.click(screen.getByRole('radio', { name: 'Quick' }))
    expect((screen.getByLabelText('Overall enjoyment', { selector: '#overall-B' }) as HTMLInputElement).value).toBe('6')
    await userEvent.click(screen.getByRole('radio', { name: 'Detailed' }))
    expect((screen.getByLabelText(/Nose/, { selector: '#nose-B' }) as HTMLInputElement).value).toBe('8')
    expect(screen.getByLabelText(/Tasting notes/, { selector: '#notes-B' })).toHaveValue('Cherry cola')
    await userEvent.click(screen.getByRole('button', { name: 'Save sample B' }))
    await waitFor(() => expect(mockSaveBallot).toHaveBeenCalled())
    expect(mockSaveBallot.mock.calls[0]![0].scores).toEqual({ B: { overall: 6, nose: 8, notes: 'Cherry cola' } })
  })

  it('shows progress and restores unsent drafts after a refresh', () => {
    const { unmount } = render(<ScoringPanel party={makeParty()} category={makeCategory()} ballot={ballot({ scores: { A: { overall: 5 } } })} />)
    expect(screen.getByText('1 of 3 saved')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Overall enjoyment', { selector: '#overall-C' }), { target: { value: '9' } })
    unmount()
    render(<ScoringPanel party={makeParty()} category={makeCategory()} ballot={ballot({ scores: { A: { overall: 5 } } })} />)
    expect((screen.getByLabelText('Overall enjoyment', { selector: '#overall-C' }) as HTMLInputElement).value).toBe('9')
  })

  it('locks submitted samples when the host disallows edits', () => {
    const party = makeParty({ settings: { ...makeParty().settings, allowEdits: false } })
    render(<ScoringPanel party={party} category={makeCategory()} ballot={ballot({ scores: { A: { overall: 5 } }, favoriteLabel: 'A' })} />)
    expect(screen.getByLabelText('Overall enjoyment', { selector: '#overall-A' })).toBeDisabled()
    expect(screen.getByLabelText('Overall enjoyment', { selector: '#overall-B' })).not.toBeDisabled()
    expect(screen.getByText('Submitted — locked by your host')).toBeInTheDocument()
  })

  it('surfaces a server rejection (e.g. voting just closed)', async () => {
    mockSaveBallot.mockRejectedValueOnce({ code: 'functions/failed-precondition', message: 'Voting isn’t open for this round.' })
    render(<ScoringPanel party={makeParty()} category={makeCategory()} ballot={undefined} />)
    fireEvent.change(screen.getByLabelText('Overall enjoyment', { selector: '#overall-A' }), { target: { value: '4' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save sample A' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Voting isn’t open for this round.')
  })
})
