import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface CapturedOptions {
  immediate?: boolean
  onNeedRefresh?: () => void
  onNeedReload?: () => void
  onRegisteredSW?: (swUrl: string, registration: { update: () => Promise<void> } | undefined) => void
}

const mockUpdateSW = vi.fn()
let capturedOptions: CapturedOptions | undefined

vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: CapturedOptions) => {
    capturedOptions = options
    return mockUpdateSW
  },
}))

import { initPwaUpdate } from './pwaUpdate'

let reloadMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  reloadMock = vi.fn()
  vi.stubGlobal('location', { ...window.location, reload: reloadMock })
  mockUpdateSW.mockReset().mockResolvedValue(undefined)
  capturedOptions = undefined
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function registerFakeSW() {
  const registration = { update: vi.fn().mockResolvedValue(undefined) }
  capturedOptions?.onRegisteredSW?.('/sw.js', registration)
  return registration
}

describe('initPwaUpdate', () => {
  it('registers immediately and surfaces onNeedRefresh to the caller', () => {
    const onNeedRefresh = vi.fn()
    initPwaUpdate(onNeedRefresh)

    expect(capturedOptions?.immediate).toBe(true)
    capturedOptions?.onNeedRefresh?.()
    expect(onNeedRefresh).toHaveBeenCalledTimes(1)
  })

  it('never reloads automatically just from registering or the passage of time', () => {
    initPwaUpdate(vi.fn())
    registerFakeSW()

    vi.advanceTimersByTime(10 * 60 * 60 * 1000) // 10 hours — well past the check interval
    expect(reloadMock).not.toHaveBeenCalled()
  })

  it('checks for an update every 60 minutes once registered', () => {
    initPwaUpdate(vi.fn())
    const registration = registerFakeSW()

    vi.advanceTimersByTime(60 * 60 * 1000)
    expect(registration.update).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(60 * 60 * 1000)
    expect(registration.update).toHaveBeenCalledTimes(2)
  })

  it('checks for an update when the document becomes visible again', () => {
    initPwaUpdate(vi.fn())
    const registration = registerFakeSW()

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  it('stops periodic checks after teardown', () => {
    const controller = initPwaUpdate(vi.fn())
    const registration = registerFakeSW()

    controller.teardown()
    vi.advanceTimersByTime(5 * 60 * 60 * 1000)

    expect(registration.update).not.toHaveBeenCalled()
  })

  it('reload only happens after refresh() is called, driven by onNeedReload, and only once', async () => {
    const controller = initPwaUpdate(vi.fn())

    await controller.refresh()
    expect(mockUpdateSW).toHaveBeenCalledTimes(1)
    expect(reloadMock).not.toHaveBeenCalled()

    capturedOptions?.onNeedReload?.()
    expect(reloadMock).toHaveBeenCalledTimes(1)

    // A second signal (or the fallback timer firing later) must not reload again.
    capturedOptions?.onNeedReload?.()
    vi.advanceTimersByTime(5000)
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to a reload if the controllerchange-driven signal never arrives', async () => {
    const controller = initPwaUpdate(vi.fn())

    await controller.refresh()
    expect(reloadMock).not.toHaveBeenCalled()

    vi.advanceTimersByTime(3000)
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })

  it('refresh() only calls the update mechanism once even if invoked repeatedly', async () => {
    const controller = initPwaUpdate(vi.fn())

    await Promise.all([controller.refresh(), controller.refresh(), controller.refresh()])

    expect(mockUpdateSW).toHaveBeenCalledTimes(1)
  })
})
