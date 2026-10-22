import { describe, expect, it } from 'vitest'
import { googleMessage } from './googleMessage'

describe('googleMessage', () => {
  it('says nothing when Google answered with confidence', () => {
    expect(googleMessage({ status: 'identified', result: { confidence: 'high' } as never }, undefined)).toBeNull()
  })

  it('flags a low-confidence answer', () => {
    expect(googleMessage({ status: 'identified', result: { confidence: 'low' } as never }, undefined)).toMatchObject({ kind: 'info', text: expect.stringMatching(/isn’t sure/) })
  })

  it('says Google couldn’t identify it, and offers the next steps', () => {
    expect(googleMessage({ status: 'not-found' }, undefined)).toEqual({ kind: 'info', text: 'Google couldn’t identify this barcode. Ask AXE, scan the front label, or enter it yourself.' })
  })

  it('names why Google was skipped, from the catalog lookup alone', () => {
    expect(googleMessage(undefined, 'off')?.text).toMatch(/turned off/)
    expect(googleMessage(undefined, 'no-key')?.text).toMatch(/no API key/)
    expect(googleMessage(undefined, 'config-error')?.text).toMatch(/settings/)
    expect(googleMessage(undefined, 'budget')?.text).toMatch(/spending limit/)
    expect(googleMessage(undefined, 'off')?.kind).toBe('problem')
    expect(googleMessage(undefined, 'available')).toBeNull()
    expect(googleMessage(undefined, undefined)).toBeNull()
  })

  it('names why a Google call failed', () => {
    expect(googleMessage({ status: 'error', reason: 'auth' }, 'available')?.text).toMatch(/didn’t accept FIP’s API key/)
    expect(googleMessage({ status: 'error', reason: 'model-unavailable' }, 'available')?.text).toMatch(/model isn’t available/)
    expect(googleMessage({ status: 'error', reason: 'quota' }, 'available')?.text).toMatch(/usage limit/)
    expect(googleMessage({ status: 'error' }, 'available')).toMatchObject({ kind: 'problem', text: expect.stringMatching(/^Google search failed\./) })
    expect(googleMessage({ status: 'rate-limited' }, 'available')?.text).toMatch(/hourly limit/)
  })
})
