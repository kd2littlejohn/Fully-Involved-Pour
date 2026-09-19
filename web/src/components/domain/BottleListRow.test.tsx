import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BottleListRow } from './BottleListRow'
import type { Bottle } from '../../data/types'

const mockUseUserData = vi.fn()
const mockUpdateBottle = vi.fn().mockResolvedValue(undefined)

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => mockUseUserData(),
}))

function mockData(bottles: Bottle[]) {
  mockUseUserData.mockReturnValue({
    userDoc: { bottles, pours: [], memories: [], infinityBottles: [], customLibrary: [], people: [] },
    updateBottle: mockUpdateBottle,
  })
}

function renderRow(bottle: Bottle, props: Partial<{ selectable: boolean; selected: boolean; onToggleSelect: () => void }> = {}) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<BottleListRow bottle={bottle} {...props} />} />
      </Routes>
    </MemoryRouter>,
  )
}

const sealed: Bottle = { id: 'b1', name: 'Weller 12', distillery: 'Buffalo Trace', status: 'sealed' }

describe('BottleListRow', () => {
  beforeEach(() => {
    mockUpdateBottle.mockClear()
  })

  it('links the row to the bottle details route', () => {
    mockData([sealed])
    renderRow(sealed)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/collection/b1')
  })

  it('changes status by tapping the status pill directly, without a menu', async () => {
    mockData([sealed])
    renderRow(sealed)

    await userEvent.click(screen.getByRole('button', { name: 'Sealed' }))
    await userEvent.click(screen.getByRole('button', { name: 'Opened' }))

    expect(mockUpdateBottle).toHaveBeenCalledWith('b1', { status: 'open', openedDate: expect.any(String) })
  })

  it('shows type alongside distillery', () => {
    const withType: Bottle = { ...sealed, type: 'Bourbon' }
    mockData([withType])
    renderRow(withType)
    expect(screen.getByText('Buffalo Trace · Bourbon')).toBeInTheDocument()
  })

  it('shows fill percent for a single open bottle', () => {
    const open: Bottle = { ...sealed, status: 'open', fillLevel: 'half' }
    mockData([open])
    renderRow(open)
    expect(screen.getByText('50% Full')).toBeInTheDocument()
  })

  it('shows a quantity badge for a plain bottle with quantity greater than one', () => {
    const multiQty: Bottle = { ...sealed, quantity: 4 }
    mockData([multiQty])
    renderRow(multiQty)
    expect(screen.getByText('× 4')).toBeInTheDocument()
  })

  it('renders as a selection checkbox instead of a link when selectable, with a non-interactive status pill', async () => {
    mockData([sealed])
    const onToggleSelect = vi.fn()
    renderRow(sealed, { selectable: true, onToggleSelect })

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sealed' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('checkbox'))
    expect(onToggleSelect).toHaveBeenCalled()
  })
})
