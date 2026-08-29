import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { YourBottlesSection } from './YourBottlesSection'
import type { Bottle, BottleInstance, Pour } from '../../data/types'

const mockUpdateBottleInstance = vi.fn().mockResolvedValue(undefined)
const mockDeleteBottleInstance = vi.fn().mockResolvedValue(undefined)
const mockOpenBottleInstance = vi.fn().mockResolvedValue(undefined)
const mockOpenNextBottleInstance = vi.fn().mockResolvedValue(undefined)

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({
    updateBottleInstance: mockUpdateBottleInstance,
    deleteBottleInstance: mockDeleteBottleInstance,
    openBottleInstance: mockOpenBottleInstance,
    openNextBottleInstance: mockOpenNextBottleInstance,
  }),
}))

function bottle(instances: BottleInstance[], overrides: Partial<Bottle> = {}): Bottle {
  return { id: 'bt1', name: 'Eagle Rare', status: 'open', instances, ...overrides }
}

async function openMenu(label: string) {
  await userEvent.click(screen.getByRole('button', { name: `${label} actions` }))
}

beforeEach(() => {
  mockUpdateBottleInstance.mockClear()
  mockDeleteBottleInstance.mockClear()
  mockOpenBottleInstance.mockClear()
  mockOpenNextBottleInstance.mockClear()
})

describe('YourBottlesSection', () => {
  it('renders nothing when there are no instances', () => {
    const { container } = render(<YourBottlesSection bottle={bottle([])} pours={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists each instance with its label, status, and purchase/opened/finished meta', () => {
    render(
      <YourBottlesSection
        bottle={bottle([
          { id: 'i1', status: 'finished', purchaseDate: '2026-08-01', price: 39.99, storeLocation: 'ABC Store', openedDate: '2026-08-18', finishedDate: '2026-11-04', createdAt: 1 },
          { id: 'i2', status: 'open', createdAt: 2 },
          { id: 'i3', status: 'sealed', createdAt: 3 },
        ])}
        pours={[]}
      />,
    )
    expect(screen.getByText('Bottle #1')).toBeInTheDocument()
    expect(screen.getByText('Purchased Aug 1, 2026 · $39.99 · ABC Store')).toBeInTheDocument()
    expect(screen.getByText('Opened Aug 18, 2026')).toBeInTheDocument()
    expect(screen.getByText('Finished Nov 4, 2026')).toBeInTheDocument()
    expect(screen.getByText('Bottle #2')).toBeInTheDocument()
    expect(screen.getByText('Bottle #3')).toBeInTheDocument()
  })

  it('shows a nickname in the row title once set', () => {
    render(<YourBottlesSection bottle={bottle([{ id: 'i1', status: 'sealed', label: 'Total Wine', createdAt: 1 }])} pours={[]} />)
    expect(screen.getByText('Bottle #1 — Total Wine')).toBeInTheDocument()
  })

  it('expanding a row and saving a nickname calls updateBottleInstance', async () => {
    render(<YourBottlesSection bottle={bottle([{ id: 'i1', status: 'sealed', createdAt: 1 }])} pours={[]} />)

    await userEvent.click(screen.getByText('Bottle #1').closest('button')!)
    await userEvent.type(screen.getByLabelText('Nickname (optional)'), 'ABC Pick')
    await userEvent.click(screen.getByRole('button', { name: 'Save Nickname' }))

    expect(mockUpdateBottleInstance).toHaveBeenCalledWith('bt1', 'i1', { label: 'ABC Pick' })
  })

  it('opening a sealed bottle with none currently open opens it immediately, no confirmation', async () => {
    render(<YourBottlesSection bottle={bottle([{ id: 'i1', status: 'sealed', createdAt: 1 }])} pours={[]} />)

    await openMenu('Bottle #1')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Open This Bottle' }))

    expect(mockOpenBottleInstance).toHaveBeenCalledWith('bt1', 'i1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opening a second bottle while one is already open requires confirmation', async () => {
    render(
      <YourBottlesSection
        bottle={bottle([
          { id: 'i1', status: 'open', createdAt: 1 },
          { id: 'i2', status: 'sealed', createdAt: 2 },
        ])}
        pours={[]}
      />,
    )

    await openMenu('Bottle #2')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Open This Bottle' }))

    expect(mockOpenBottleInstance).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/already have an open bottle/)).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Open Anyway' }))
    expect(mockOpenBottleInstance).toHaveBeenCalledWith('bt1', 'i2')
  })

  it('marking the active bottle finished with sealed backups remaining offers Open Next Bottle, not automatic', async () => {
    render(
      <YourBottlesSection
        bottle={bottle([
          { id: 'i1', status: 'open', createdAt: 1 },
          { id: 'i2', status: 'sealed', createdAt: 2 },
        ])}
        pours={[]}
      />,
    )

    await openMenu('Bottle #1')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mark Finished' }))

    expect(mockUpdateBottleInstance).toHaveBeenCalledWith('bt1', 'i1', expect.objectContaining({ status: 'finished' }))
    // Opening the next one is NOT automatic — it's an offered, separate action.
    expect(mockOpenNextBottleInstance).not.toHaveBeenCalled()

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/1 sealed Eagle Rare bottle remaining/)).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Open Next Bottle' }))
    expect(mockOpenNextBottleInstance).toHaveBeenCalledWith('bt1')
  })

  it('"Not Yet" dismisses the Open Next Bottle prompt without opening anything', async () => {
    render(
      <YourBottlesSection
        bottle={bottle([
          { id: 'i1', status: 'open', createdAt: 1 },
          { id: 'i2', status: 'sealed', createdAt: 2 },
        ])}
        pours={[]}
      />,
    )

    await openMenu('Bottle #1')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mark Finished' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Not Yet' }))

    expect(mockOpenNextBottleInstance).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not prompt to open next when no sealed bottles remain', async () => {
    render(<YourBottlesSection bottle={bottle([{ id: 'i1', status: 'open', createdAt: 1 }])} pours={[]} />)

    await openMenu('Bottle #1')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mark Finished' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('deleting an instance with no history shows the lighter confirm copy', async () => {
    render(
      <YourBottlesSection
        bottle={bottle([
          { id: 'i1', status: 'sealed', createdAt: 1 },
          { id: 'i2', status: 'sealed', createdAt: 2 },
        ])}
        pours={[]}
      />,
    )

    await openMenu('Bottle #2')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('This removes this bottle and cannot be undone.')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete Bottle' }))
    expect(mockDeleteBottleInstance).toHaveBeenCalledWith('bt1', 'i2')
  })

  it('deleting an instance with pour history shows the stronger warning', async () => {
    const pours: Pour[] = [{ id: 'p1', bottleId: 'bt1', bottleInstanceId: 'i2', date: '2026-08-01', rating: 8, fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.5, value: 1, total: 8, noseAromas: [], palateFlavors: [] } }]
    render(
      <YourBottlesSection
        bottle={bottle([
          { id: 'i1', status: 'sealed', createdAt: 1 },
          { id: 'i2', status: 'finished', createdAt: 2 },
        ])}
        pours={pours}
      />,
    )

    await openMenu('Bottle #2')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))

    expect(screen.getByText(/pours or history recorded against it/)).toBeInTheDocument()
  })

  it('does not offer Delete when only one instance remains', async () => {
    render(<YourBottlesSection bottle={bottle([{ id: 'i1', status: 'sealed', createdAt: 1 }])} pours={[]} />)
    await openMenu('Bottle #1')
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('a failed delete shows a retryable inline error', async () => {
    mockDeleteBottleInstance.mockRejectedValueOnce(new Error('offline'))
    render(
      <YourBottlesSection
        bottle={bottle([
          { id: 'i1', status: 'sealed', createdAt: 1 },
          { id: 'i2', status: 'sealed', createdAt: 2 },
        ])}
        pours={[]}
      />,
    )

    await openMenu('Bottle #2')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete Bottle' }))

    expect(await screen.findByText('Could not delete this bottle. Try again.')).toBeInTheDocument()
  })
})
