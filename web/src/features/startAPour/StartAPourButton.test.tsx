import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { StartAPourButton } from './StartAPourButton'
import type { Bottle } from '../../data/types'

const mockUseUserData = vi.fn()

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

vi.mock('../quickPour/QuickPour', () => ({
  QuickPour: ({ bottleName }: { bottleName: string }) => <div>Quick Pour view — {bottleName}</div>,
}))

vi.mock('../pourWizard/PourWizard', () => ({
  PourWizard: ({ bottleName }: { bottleName: string }) => <div>Pour Wizard view — {bottleName}</div>,
}))

const bottles: Bottle[] = [
  { id: 'b1', name: 'Eagle Rare', status: 'open' },
  { id: 'b2', name: 'Pappy 15', status: 'wishlist' },
  { id: 'b3', name: 'Weller 12', status: 'sealed' },
]

function renderWithRoute(ui: ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={ui} />
        <Route path="/collection/:bottleId" element={<div>Bottle Details Page</div>} />
        <Route path="/blind/new" element={<div>Create Blind Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('StartAPourButton', () => {
  it('jumps straight to the pour-type chooser when a bottleId is already known', async () => {
    mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] } })
    renderWithRoute(<StartAPourButton bottleId="b1" label="Start a Pour" />)

    await userEvent.click(screen.getByRole('button', { name: 'Start a Pour' }))

    expect(screen.getByText('Pouring Eagle Rare')).toBeInTheDocument()
    expect(screen.queryByText('Which bottle?')).not.toBeInTheDocument()
  })

  it('shows the pour-type chooser first when no bottleId is given, then the bottle picker', async () => {
    mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] } })
    renderWithRoute(<StartAPourButton label="Start a Pour" />)

    await userEvent.click(screen.getByRole('button', { name: 'Start a Pour' }))
    expect(screen.getByRole('heading', { name: 'Start a Pour' })).toBeInTheDocument()
    expect(screen.queryByText('Which bottle?')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Quick Pour/ }))
    expect(screen.getByText('Which bottle?')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Weller 12/ }))
    expect(screen.getByText('Quick Pour view — Weller 12')).toBeInTheDocument()
  })

  it('skips the bottle picker entirely and goes straight to Blind Room when no bottleId is given', async () => {
    mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] } })
    renderWithRoute(<StartAPourButton label="Start a Pour" />)

    await userEvent.click(screen.getByRole('button', { name: 'Start a Pour' }))
    await userEvent.click(screen.getByRole('button', { name: /Blind Room/ }))

    expect(screen.getByText('Create Blind Page')).toBeInTheDocument()
    expect(screen.queryByText('Which bottle?')).not.toBeInTheDocument()
  })

  it('opens Quick Pour when that pour type is chosen', async () => {
    mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] } })
    renderWithRoute(<StartAPourButton bottleId="b1" label="Start a Pour" />)

    await userEvent.click(screen.getByRole('button', { name: 'Start a Pour' }))
    await userEvent.click(screen.getByRole('button', { name: /Quick Pour/ }))

    expect(screen.getByText('Quick Pour view — Eagle Rare')).toBeInTheDocument()
  })

  it('opens the full wizard when Pour Story is chosen', async () => {
    mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] } })
    renderWithRoute(<StartAPourButton bottleId="b1" label="Start a Pour" />)

    await userEvent.click(screen.getByRole('button', { name: 'Start a Pour' }))
    await userEvent.click(screen.getByRole('button', { name: /Pour Story/ }))

    expect(screen.getByText('Pour Wizard view — Eagle Rare')).toBeInTheDocument()
  })

  it('navigates to the Create Blind flow when Blind Room is chosen', async () => {
    mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] } })
    renderWithRoute(<StartAPourButton bottleId="b1" label="Start a Pour" />)

    await userEvent.click(screen.getByRole('button', { name: 'Start a Pour' }))
    await userEvent.click(screen.getByRole('button', { name: /Blind Room/ }))

    expect(screen.getByText('Create Blind Page')).toBeInTheDocument()
  })

  it('routes to the Compare tab on the bottle details route when Compare is chosen', async () => {
    mockUseUserData.mockReturnValue({ userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] } })
    renderWithRoute(<StartAPourButton bottleId="b1" label="Start a Pour" />)

    await userEvent.click(screen.getByRole('button', { name: 'Start a Pour' }))
    await userEvent.click(screen.getByRole('button', { name: /Compare/ }))

    expect(screen.getByText('Bottle Details Page')).toBeInTheDocument()
  })
})
