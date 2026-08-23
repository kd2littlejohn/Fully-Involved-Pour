import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PalateMatchExplanationInput } from './palateMatchExplanation'

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

const input: PalateMatchExplanationInput = {
  bottleName: 'New Bourbon',
  score: 92,
  confidence: 'high',
  reasons: ['Its flavor profile lines up with your highest-rated pours.'],
}

beforeEach(() => {
  mockIsMockAuthEnabled.mockReset()
  mockHttpsCallable.mockReset()
  mockCallable.mockReset()
  mockHttpsCallable.mockReturnValue(mockCallable)
})

async function importRepo() {
  return import('./palateMatchExplanation')
}

describe('explainPalateMatch', () => {
  it('calls the Cloud Function with exactly the score/confidence/reasons given, and returns its explanation', async () => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    mockCallable.mockResolvedValue({ data: { known: true, explanation: 'A strong, well-grounded fit.' } })
    const { explainPalateMatch } = await importRepo()

    const result = await explainPalateMatch(input)

    expect(mockCallable).toHaveBeenCalledWith(input)
    expect(result).toBe('A strong, well-grounded fit.')
  })

  it('returns null when the AI declines (known: false)', async () => {
    mockIsMockAuthEnabled.mockReturnValue(false)
    mockCallable.mockResolvedValue({ data: { known: false } })
    const { explainPalateMatch } = await importRepo()

    const result = await explainPalateMatch(input)

    expect(result).toBeNull()
  })

  it('in mock-auth dev mode, returns a deterministic explanation without touching the Cloud Function', async () => {
    mockIsMockAuthEnabled.mockReturnValue(true)
    const { explainPalateMatch } = await importRepo()

    const result = await explainPalateMatch(input)

    expect(result).toBeTruthy()
    expect(mockHttpsCallable).not.toHaveBeenCalled()
  })

  it('returns null in mock mode too when there are no reasons to ground an explanation in', async () => {
    mockIsMockAuthEnabled.mockReturnValue(true)
    const { explainPalateMatch } = await importRepo()

    const result = await explainPalateMatch({ ...input, reasons: [] })

    expect(result).toBeNull()
  })
})
