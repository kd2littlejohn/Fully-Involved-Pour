import { describe, expect, it, vi } from 'vitest'

vi.mock('../devMode', () => ({ isMockAuthEnabled: () => true }))

import {
  askSommelier,
  lookupBottleInfo,
  generateTastingProfile,
  scanBottleLabel,
  removeBottleBackground,
  recommendBottles,
  lookupDistillery,
} from './ai'

describe('ai repository (mock mode)', () => {
  it('askSommelier returns a canned reply without calling Cloud Functions', async () => {
    const reply = await askSommelier('what should I try next', [], '')
    expect(reply.length).toBeGreaterThan(0)
  })

  it('lookupBottleInfo returns known: false in mock mode', async () => {
    const result = await lookupBottleInfo('Some Bottle')
    expect(result.known).toBe(false)
  })

  it('generateTastingProfile returns a full tasting profile', async () => {
    const profile = await generateTastingProfile({ bottleName: 'Eagle Rare' })
    expect(profile.nose).toBeTruthy()
    expect(profile.palate).toBeTruthy()
    expect(profile.finish).toBeTruthy()
    expect(profile.flavors.length).toBeGreaterThan(0)
  })

  it('scanBottleLabel returns a found fixture bottle', async () => {
    const result = await scanBottleLabel('base64data', 'image/jpeg')
    expect(result.found).toBe(true)
    expect(result.name).toBeTruthy()
  })

  it('removeBottleBackground returns the input unchanged', async () => {
    const result = await removeBottleBackground('abc123')
    expect(result).toBe('abc123')
  })

  it('recommendBottles returns canned recommendations', async () => {
    const results = await recommendBottles('Eagle Rare (Buffalo Trace, Bourbon)')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.name).toBeTruthy()
  })

  it('lookupDistillery returns known info in mock mode', async () => {
    const result = await lookupDistillery('Buffalo Trace')
    expect(result.known).toBe(true)
    expect(result.location).toBeTruthy()
  })
})
