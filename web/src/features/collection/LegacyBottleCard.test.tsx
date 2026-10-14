import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LegacyBottleCard } from './LegacyBottleCard'
import type { Bottle } from '../../data/types'

const mockUpdateBottle = vi.fn().mockResolvedValue(undefined)
vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ updateBottle: mockUpdateBottle }),
}))

function BottleRoute() {
  const location = useLocation()
  return <div>Bottle page {JSON.stringify(location.state)}</div>
}

function renderCard(bottles: Bottle[]) {
  return render(
    <MemoryRouter initialEntries={['/collection']}>
      <Routes>
        <Route path="/collection" element={<LegacyBottleCard bottles={bottles} />} />
        <Route path="/collection/:bottleId" element={<BottleRoute />} />
      </Routes>
    </MemoryRouter>,
  )
}

const blantons: Bottle = {
  id: 'b1',
  name: "Blanton's Original",
  distillery: 'Buffalo Trace',
  status: 'finished',
  imageUrl: 'https://example.com/blantons.jpg',
  legacyShelf: true,
  legacyShelfReason: 'First bourbon I ever loved',
  createdAt: 1,
}
const weller: Bottle = { id: 'b2', name: 'Weller 12', status: 'open', createdAt: 2 }

describe('LegacyBottleCard', () => {
  beforeEach(() => mockUpdateBottle.mockClear())

  it('features the designated bottle with its real photo, story and status, finished included', () => {
    const { container } = renderCard([blantons, weller])
    expect(screen.getByRole('heading', { name: "Blanton's Original" })).toBeInTheDocument()
    expect(screen.getByText('“First bourbon I ever loved”')).toBeInTheDocument()
    expect(screen.getByText('Buffalo Trace · Finished')).toBeInTheDocument()
    const photos = Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'))
    expect(photos).toContain('https://example.com/blantons.jpg')
  })

  it('opens the bottle on its Journey (story and memories)', async () => {
    renderCard([blantons])
    await userEvent.click(screen.getByRole('link', { name: 'Open Story' }))
    expect(screen.getByText(/Bottle page/)).toHaveTextContent('"initialTab":"journey"')
  })

  it('shows a quiet setup prompt, not an empty card, when no Legacy Bottle is designated', () => {
    renderCard([weller])
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose a Legacy Bottle' })).toBeInTheDocument()
  })

  it('designates an existing bottle (no new record) with an optional reason', async () => {
    renderCard([weller])
    await userEvent.click(screen.getByRole('button', { name: 'Choose a Legacy Bottle' }))
    const dialog = screen.getByRole('dialog', { hidden: true })
    await userEvent.click(within(dialog).getByRole('button', { name: /Weller 12/ }))
    await userEvent.type(within(dialog).getByLabelText('Why it matters (optional)'), 'Shared with Dad')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Make it my Legacy Bottle' }))
    expect(mockUpdateBottle).toHaveBeenCalledWith('b2', { legacyShelf: true, legacyShelfReason: 'Shared with Dad' })
  })

  it('keeps an existing saved reason when none is entered', async () => {
    const withOldReason: Bottle = { ...weller, legacyShelfReason: 'Old note' }
    renderCard([withOldReason])
    await userEvent.click(screen.getByRole('button', { name: 'Choose a Legacy Bottle' }))
    const dialog = screen.getByRole('dialog', { hidden: true })
    await userEvent.click(within(dialog).getByRole('button', { name: /Weller 12/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Make it my Legacy Bottle' }))
    expect(mockUpdateBottle).toHaveBeenCalledWith('b2', { legacyShelf: true })
  })

  it('cycles through several Legacy Bottles', async () => {
    renderCard([blantons, { ...weller, legacyShelf: true }])
    await userEvent.click(screen.getByRole('button', { name: /1 of 2/ }))
    expect(screen.getByRole('heading', { name: 'Weller 12' })).toBeInTheDocument()
  })
})
