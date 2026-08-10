import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UpdateAvailableBanner } from './UpdateAvailableBanner'

const mockRefresh = vi.fn().mockResolvedValue(undefined)
const mockTeardown = vi.fn()
let capturedOnNeedRefresh: (() => void) | undefined

vi.mock('../../pwaUpdate', () => ({
  initPwaUpdate: (onNeedRefresh: () => void) => {
    capturedOnNeedRefresh = onNeedRefresh
    return { refresh: mockRefresh, teardown: mockTeardown }
  },
}))

beforeEach(() => {
  mockRefresh.mockClear()
  mockTeardown.mockClear()
  capturedOnNeedRefresh = undefined
})

function fireUpdateAvailable() {
  act(() => {
    capturedOnNeedRefresh?.()
  })
}

describe('UpdateAvailableBanner', () => {
  it('renders nothing by default', () => {
    render(<UpdateAvailableBanner />)
    expect(screen.queryByText('An update is ready.')).not.toBeInTheDocument()
  })

  it('does not call refresh just from mounting or an update becoming available', () => {
    render(<UpdateAvailableBanner />)
    fireUpdateAvailable()
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('shows the banner once an update is available', () => {
    render(<UpdateAvailableBanner />)
    fireUpdateAvailable()
    expect(screen.getByText('An update is ready.')).toBeInTheDocument()
  })

  it('does not stack multiple banners when the update signal fires more than once', () => {
    render(<UpdateAvailableBanner />)
    fireUpdateAvailable()
    fireUpdateAvailable()
    fireUpdateAvailable()
    expect(screen.getAllByText('An update is ready.')).toHaveLength(1)
  })

  it('Later dismisses the banner', async () => {
    render(<UpdateAvailableBanner />)
    fireUpdateAvailable()

    await userEvent.click(screen.getByRole('button', { name: 'Later' }))

    expect(screen.queryByText('An update is ready.')).not.toBeInTheDocument()
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('Refresh Now invokes the update handler exactly once', async () => {
    render(<UpdateAvailableBanner />)
    fireUpdateAvailable()

    const button = screen.getByRole('button', { name: 'Refresh Now' })
    await userEvent.click(button)
    // The button disables itself immediately, so a rapid second click can't
    // fire another handler call — this is the UI-level half of the
    // "reload exactly once" guarantee (pwaUpdate.ts's own guard is the other half).
    await userEvent.click(button)

    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })

  it('tears down the update controller on unmount', () => {
    const { unmount } = render(<UpdateAvailableBanner />)
    unmount()
    expect(mockTeardown).toHaveBeenCalledTimes(1)
  })
})
