import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuickPour } from './QuickPour'

const mockAddPour = vi.fn().mockResolvedValue(undefined)

vi.mock('../../hooks/useUserData', () => ({
  useUserData: () => ({ addPour: mockAddPour }),
}))

beforeEach(() => {
  mockAddPour.mockClear()
})

describe('QuickPour', () => {
  it('does not show flavor chips or a score until a reaction is picked', () => {
    render(<QuickPour bottleId="b1" bottleName="Eagle Rare" onClose={vi.fn()} />)

    expect(screen.queryByText('What stands out? (optional)')).not.toBeInTheDocument()
    expect(screen.queryByText('Score')).not.toBeInTheDocument()
  })

  it('disables Save Pour until a reaction is picked', () => {
    render(<QuickPour bottleId="b1" bottleName="Eagle Rare" onClose={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Save Pour' })).toBeDisabled()
  })

  it('reveals flavor chips and the reaction-implied score once a reaction is picked', async () => {
    render(<QuickPour bottleId="b1" bottleName="Eagle Rare" onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /Love it/ }))

    expect(screen.getByText('What stands out? (optional)')).toBeInTheDocument()
    expect(screen.getByText('9.2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Pour' })).toBeEnabled()
  })

  it('saves in two taps: reaction, then Save Pour — no flavors or score adjustment required', async () => {
    const onSaved = vi.fn()
    const onClose = vi.fn()
    render(<QuickPour bottleId="b1" bottleName="Eagle Rare" onClose={onClose} onSaved={onSaved} />)

    await userEvent.click(screen.getByRole('button', { name: /Enjoying it/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Save Pour' }))

    expect(mockAddPour).toHaveBeenCalledTimes(1)
    const saved = mockAddPour.mock.calls[0]![0]
    expect(saved.bottleId).toBe('b1')
    expect(saved.rating).toBe(8.0)
    expect(saved.mood).toBe('Enjoying it')
    expect(saved.fip.palateFlavors).toEqual([])
    expect(onSaved).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('includes tapped flavor chips in the saved pour', async () => {
    render(<QuickPour bottleId="b1" bottleName="Eagle Rare" onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /Love it/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Vanilla' }))
    await userEvent.click(screen.getByRole('button', { name: 'Oak' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save Pour' }))

    const saved = mockAddPour.mock.calls[0]![0]
    expect(saved.fip.palateFlavors).toEqual(['Vanilla', 'Oak'])
  })

  it('lets the reaction-implied score be adjusted before saving', async () => {
    render(<QuickPour bottleId="b1" bottleName="Eagle Rare" onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /Love it/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Adjust' }))

    const slider = screen.getByLabelText('Adjust score')
    fireChange(slider, '7.5')
    await userEvent.click(screen.getByRole('button', { name: 'Save Pour' }))

    const saved = mockAddPour.mock.calls[0]![0]
    expect(saved.rating).toBe(7.5)
  })

  it('switching reactions replaces the previous selection rather than stacking', async () => {
    render(<QuickPour bottleId="b1" bottleName="Eagle Rare" onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /Love it/ }))
    await userEvent.click(screen.getByRole('button', { name: /Not for me/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Save Pour' }))

    const saved = mockAddPour.mock.calls[0]![0]
    expect(saved.mood).toBe('Not for me')
    expect(saved.rating).toBe(4.0)
  })
})

function fireChange(element: HTMLElement, value: string) {
  const input = element as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event('change', { bubbles: true }))
}
