import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TastingSummaryInput } from './tastingSummary'

const mockIsMockAuthEnabled = vi.fn()
const mockHttpsCallable = vi.fn()
const mockCallable = vi.fn()

vi.mock('../devMode', () => ({
  isMockAuthEnabled: () => mockIsMockAuthEnabled(),
}))

vi.mock('../firebase', () => ({
  functions: {},
}))

vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}))

const richInput: TastingSummaryInput = {
  noseAromas: ['Vanilla'],
  palateFlavors: ['Caramel', 'Oak'],
  palateNotes: 'Rich caramel up front, drying oak on the back end.',
  rating: 8.6,
}

const emptyInput: TastingSummaryInput = {
  noseAromas: [],
  palateFlavors: [],
  rating: 7,
}

beforeEach(() => {
  mockIsMockAuthEnabled.mockReset()
  mockHttpsCallable.mockReset()
  mockCallable.mockReset()
  mockHttpsCallable.mockReturnValue(mockCallable)
  vi.resetModules()
})

async function importTastingSummary() {
  return import('./tastingSummary')
}

describe('generateTastingSummary', () => {
  it('returns null without touching the Cloud Function when there is nothing tasting-relevant to summarize', async () => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    const { generateTastingSummary } = await importTastingSummary()

    const result = await generateTastingSummary(emptyInput)

    expect(result).toBeNull()
    expect(mockHttpsCallable).not.toHaveBeenCalled()
  })

  it('calls the Cloud Function with exactly the tasting fields, and returns its summary', async () => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    mockCallable.mockResolvedValue({ data: { known: true, summary: 'Rich caramel and oak, a satisfying pour.' } })
    const { generateTastingSummary } = await importTastingSummary()

    const result = await generateTastingSummary(richInput)

    expect(mockCallable).toHaveBeenCalledWith(richInput)
    expect(result).toBe('Rich caramel and oak, a satisfying pour.')
  })

  it('returns null when the AI declines (known: false), never throwing back into the save flow', async () => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    mockCallable.mockResolvedValue({ data: { known: false } })
    const { generateTastingSummary } = await importTastingSummary()

    const result = await generateTastingSummary(richInput)

    expect(result).toBeNull()
  })

  it('in mock-auth dev mode, returns a deterministic summary without touching the Cloud Function', async () => {
    mockIsMockAuthEnabled.mockReturnValue(true)
    const { generateTastingSummary } = await importTastingSummary()

    const first = await generateTastingSummary(richInput)
    const second = await generateTastingSummary(richInput)

    expect(first).toBeTruthy()
    expect(second).toBe(first)
    expect(mockHttpsCallable).not.toHaveBeenCalled()
  })
})

describe('hashTastingInput', () => {
  it('is stable for the same input', async () => {
    const { hashTastingInput } = await importTastingSummary()
    expect(hashTastingInput(richInput)).toBe(hashTastingInput({ ...richInput }))
  })

  it('is insensitive to tag order', async () => {
    const { hashTastingInput } = await importTastingSummary()
    const reordered = { ...richInput, palateFlavors: ['Oak', 'Caramel'] }
    expect(hashTastingInput(richInput)).toBe(hashTastingInput(reordered))
  })

  it('changes when a tasting-relevant field changes', async () => {
    const { hashTastingInput } = await importTastingSummary()
    const edited = { ...richInput, palateNotes: 'Something completely different.' }
    expect(hashTastingInput(richInput)).not.toBe(hashTastingInput(edited))
  })

  it('changes when the rating changes, since it can shift the appropriate tone', async () => {
    const { hashTastingInput } = await importTastingSummary()
    const edited = { ...richInput, rating: 4.0 }
    expect(hashTastingInput(richInput)).not.toBe(hashTastingInput(edited))
  })
})
