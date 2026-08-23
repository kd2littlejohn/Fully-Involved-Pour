import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateAndSaveTastingSummary } from './tastingSummaryOnSave'
import type { Pour } from '../../data/types'

const mockGenerateTastingSummary = vi.fn()
const mockHashTastingInput = vi.fn()

vi.mock('../../data/repositories/tastingSummary', () => ({
  generateTastingSummary: (...args: unknown[]) => mockGenerateTastingSummary(...args),
  hashTastingInput: (...args: unknown[]) => mockHashTastingInput(...args),
}))

function pour(overrides: Partial<Pour> = {}): Pour {
  return {
    id: 'p1',
    bottleId: 'b1',
    date: '2026-08-14',
    rating: 8.6,
    fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.8, value: 1, total: 8.6, noseAromas: ['Vanilla'], palateFlavors: [] },
    ...overrides,
  }
}

beforeEach(() => {
  mockGenerateTastingSummary.mockReset()
  mockHashTastingInput.mockReset()
  mockHashTastingInput.mockReturnValue('hash-1')
})

describe('generateAndSaveTastingSummary', () => {
  it('skips entirely when the source hash matches what is already stored — nothing tasting-relevant changed', async () => {
    const updatePourAiSummary = vi.fn()
    const p = pour({ aiSummary: { text: 'Existing.', sourceHash: 'hash-1', generatedAt: 1 } })

    await generateAndSaveTastingSummary(p, updatePourAiSummary)

    expect(mockGenerateTastingSummary).not.toHaveBeenCalled()
    expect(updatePourAiSummary).not.toHaveBeenCalled()
  })

  it('regenerates when the stored hash differs from the current one', async () => {
    const updatePourAiSummary = vi.fn().mockResolvedValue(undefined)
    mockGenerateTastingSummary.mockResolvedValue('A bright, vanilla-forward pour.')
    const p = pour({ aiSummary: { text: 'Stale.', sourceHash: 'hash-old', generatedAt: 1 } })

    await generateAndSaveTastingSummary(p, updatePourAiSummary)

    expect(mockGenerateTastingSummary).toHaveBeenCalledWith({
      noseAromas: ['Vanilla'],
      noseNotes: undefined,
      palateFlavors: [],
      palateNotes: undefined,
      finishNotes: undefined,
      rating: 8.6,
    })
    expect(updatePourAiSummary).toHaveBeenCalledWith('p1', {
      text: 'A bright, vanilla-forward pour.',
      sourceHash: 'hash-1',
      generatedAt: expect.any(Number),
    })
  })

  it('does not call updatePourAiSummary when the AI returns nothing meaningful', async () => {
    const updatePourAiSummary = vi.fn()
    mockGenerateTastingSummary.mockResolvedValue(null)

    await generateAndSaveTastingSummary(pour(), updatePourAiSummary)

    expect(updatePourAiSummary).not.toHaveBeenCalled()
  })

  it('never throws when the AI call fails — logs and resolves quietly instead', async () => {
    const updatePourAiSummary = vi.fn()
    mockGenerateTastingSummary.mockRejectedValue(new Error('network error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(generateAndSaveTastingSummary(pour(), updatePourAiSummary)).resolves.toBeUndefined()

    expect(updatePourAiSummary).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('never throws when persisting the result fails either', async () => {
    const updatePourAiSummary = vi.fn().mockRejectedValue(new Error('write failed'))
    mockGenerateTastingSummary.mockResolvedValue('A pour worth remembering.')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(generateAndSaveTastingSummary(pour(), updatePourAiSummary)).resolves.toBeUndefined()

    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
