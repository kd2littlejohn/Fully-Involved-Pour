import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { TastingEntries } from './TastingEntries'

const mockOpenTasting = vi.fn()
vi.mock('../startAPour/usePourHub', () => ({
  usePourHub: () => ({ open: vi.fn(), openTasting: mockOpenTasting, modal: null }),
}))

function renderEntries(hasBottles: boolean) {
  return render(
    <MemoryRouter>
      <TastingEntries hasBottles={hasBottles} />
    </MemoryRouter>,
  )
}

describe('TastingEntries', () => {
  it('Log a Tasting goes straight to picking a bottle from My Bar', async () => {
    renderEntries(true)
    await userEvent.click(screen.getByRole('button', { name: /Log a Tasting/ }))
    expect(mockOpenTasting).toHaveBeenCalledTimes(1)
  })

  it('Blind Tastings opens the Blind Room', () => {
    renderEntries(true)
    expect(screen.getByRole('link', { name: /Blind Tastings/ })).toHaveAttribute('href', '/blind')
  })

  it('with an empty bar, Log a Tasting leads to adding a bottle first', () => {
    renderEntries(false)
    expect(screen.getByRole('link', { name: /Log a Tasting/ })).toHaveAttribute('href', '/bottles/new')
  })
})
