import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PourRecommendationExplanationInput } from './pourRecommendationExplanation'

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

const input: PourRecommendationExplanationInput = {
  bottleName: 'Eagle Rare 10',
  distillery: 'Buffalo Trace',
  type: 'Bourbon',
  moodLabel: 'Something Special',
  reasons: ["You've only poured this once."],
  tags: ['Strong palate fit'],
}

beforeEach(() => {
  mockIsMockAuthEnabled.mockReset()
  mockHttpsCallable.mockReset()
  mockCallable.mockReset()
  mockHttpsCallable.mockReturnValue(mockCallable)
})

async function importRepo() {
  return import('./pourRecommendationExplanation')
}

describe('explainPourRecommendation', () => {
  it('calls the Cloud Function with exactly the bottle facts, mood, reasons, and tags given', async () => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    mockCallable.mockResolvedValue({ data: { known: true, explanation: 'A special-occasion pour worth savoring tonight.' } })
    const { explainPourRecommendation } = await importRepo()

    const result = await explainPourRecommendation(input)

    expect(mockCallable).toHaveBeenCalledWith(input)
    expect(result).toBe('A special-occasion pour worth savoring tonight.')
  })

  it('returns null when the AI declines (known: false)', async () => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    mockCallable.mockResolvedValue({ data: { known: false } })
    const { explainPourRecommendation } = await importRepo()

    const result = await explainPourRecommendation(input)

    expect(result).toBeNull()
  })

  it('in mock-auth dev mode, returns a deterministic explanation without touching the Cloud Function', async () => {
    mockIsMockAuthEnabled.mockReturnValue(true)
    const { explainPourRecommendation } = await importRepo()

    const result = await explainPourRecommendation(input)

    expect(result).toBeTruthy()
    expect(mockHttpsCallable).not.toHaveBeenCalled()
  })
})
