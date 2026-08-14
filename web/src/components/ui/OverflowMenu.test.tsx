import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OverflowMenu } from './OverflowMenu'

describe('OverflowMenu', () => {
  it('is closed by default', () => {
    render(<OverflowMenu items={[{ label: 'Edit', onClick: vi.fn() }]} />)
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('opens on trigger click and shows every item', async () => {
    render(
      <OverflowMenu
        items={[
          { label: 'Edit Bottle', onClick: vi.fn() },
          { label: 'Delete Bottle', onClick: vi.fn(), tone: 'danger' },
        ]}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'More actions' }))

    expect(screen.getByRole('menuitem', { name: 'Edit Bottle' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Delete Bottle' })).toBeInTheDocument()
  })

  it('calls the item handler and closes the menu when an item is clicked', async () => {
    const onClick = vi.fn()
    render(<OverflowMenu items={[{ label: 'Edit Bottle', onClick }]} />)

    await userEvent.click(screen.getByRole('button', { name: 'More actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit Bottle' }))

    expect(onClick).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('closes when clicking outside the menu', async () => {
    render(
      <div>
        <OverflowMenu items={[{ label: 'Edit Bottle', onClick: vi.fn() }]} />
        <button type="button">Outside</button>
      </div>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'More actions' }))
    expect(screen.getByRole('menuitem')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Outside' }))
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    render(<OverflowMenu items={[{ label: 'Edit Bottle', onClick: vi.fn() }]} />)

    await userEvent.click(screen.getByRole('button', { name: 'More actions' }))
    expect(screen.getByRole('menuitem')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  it('does not invoke a disabled item on click', async () => {
    const onClick = vi.fn()
    render(<OverflowMenu items={[{ label: 'Mark as Finished', onClick, disabled: true }]} />)

    await userEvent.click(screen.getByRole('button', { name: 'More actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Mark as Finished' }))

    expect(onClick).not.toHaveBeenCalled()
  })
})
