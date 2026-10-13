import { describe, expect, it } from 'vitest'
import { splitBottleTitle } from './bottleTitle'

describe('splitBottleTitle', () => {
  it('splits on a spaced dash into title and subtitle', () => {
    expect(splitBottleTitle('Elijah Craig Small Batch - 2026 PGA Championship Edition')).toEqual({
      title: 'Elijah Craig Small Batch',
      subtitle: '2026 PGA Championship Edition',
    })
  })

  it('splits on an em dash', () => {
    expect(splitBottleTitle('Weller 12 Year — Wheated Bourbon')).toEqual({
      title: 'Weller 12 Year',
      subtitle: 'Wheated Bourbon',
    })
  })

  it('splits a trailing parenthetical', () => {
    expect(splitBottleTitle('E.H. Taylor Jr. Single Barrel (Barrel Proof)')).toEqual({
      title: 'E.H. Taylor Jr. Single Barrel',
      subtitle: 'Barrel Proof',
    })
  })

  it('leaves an ordinary name whole when there is no clear separator', () => {
    expect(splitBottleTitle('Buffalo Trace')).toEqual({ title: 'Buffalo Trace' })
  })

  it('does not false-split a compact hyphenation with no surrounding spaces', () => {
    expect(splitBottleTitle("E.H. Taylor Jr.")).toEqual({ title: 'E.H. Taylor Jr.' })
  })

  it('does not split when there are multiple dash-separated segments (ambiguous)', () => {
    expect(splitBottleTitle('A - B - C')).toEqual({ title: 'A - B - C' })
  })

  it('trims surrounding whitespace on both parts', () => {
    expect(splitBottleTitle('  Old Forester 1910  -  Kentucky Straight  ')).toEqual({
      title: 'Old Forester 1910',
      subtitle: 'Kentucky Straight',
    })
  })

  it('splits a trailing batch or release identifier', () => {
    expect(splitBottleTitle('Stagg Kentucky Straight Bourbon Batch 25A')).toEqual({
      title: 'Stagg Kentucky Straight Bourbon',
      subtitle: 'Batch 25A',
    })
    expect(splitBottleTitle("Booker's Batch 2024-03")).toEqual({ title: "Booker's", subtitle: 'Batch 2024-03' })
    expect(splitBottleTitle('Old Forester Birthday Bourbon Release #4')).toEqual({
      title: 'Old Forester Birthday Bourbon',
      subtitle: 'Release #4',
    })
  })

  it('never splits ordinary words that only look like release terms', () => {
    expect(splitBottleTitle('Elijah Craig Small Batch')).toEqual({ title: 'Elijah Craig Small Batch' })
    expect(splitBottleTitle('Batch 25A')).toEqual({ title: 'Batch 25A' })
    expect(splitBottleTitle('Limited Edition')).toEqual({ title: 'Limited Edition' })
  })
})
