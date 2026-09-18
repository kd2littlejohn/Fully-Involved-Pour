import { describe, expect, it } from 'vitest'
import { FLAVOR_DESCRIPTORS, FLAVOR_FAMILIES, FINISH_DESCRIPTORS, findDescriptor, findFinishDescriptor } from './taxonomy'
import { FLAVOR_AXES } from '../flavorRadar/flavorCategories'

// Every descriptor string ever stored on a saved Pour before this feature
// shipped — must stay selectable under its new family, verbatim, forever.
const LEGACY_NOSE_PALATE_LABELS = [
  'Brown Sugar',
  'Vanilla',
  'Oak',
  'Caramel',
  'Cherry',
  'Honey',
  'Cinnamon',
  'Orange Peel',
  'Leather',
  'Baking Spice',
  'Toffee',
  'Butterscotch',
  'Dark Fruit',
  'Black Pepper',
  'Corn Sweetness',
  'Tobacco',
]

describe('FLAVOR_FAMILIES', () => {
  it('has exactly 8 families, each with a non-empty identity label', () => {
    expect(FLAVOR_FAMILIES).toHaveLength(8)
    for (const family of FLAVOR_FAMILIES) {
      expect(family.identityLabel.trim().length).toBeGreaterThan(0)
      expect(family.shortLabel.trim().length).toBeGreaterThan(0)
    }
  })

  it('has no duplicate ids or short labels', () => {
    expect(new Set(FLAVOR_FAMILIES.map((f) => f.id)).size).toBe(8)
    expect(new Set(FLAVOR_FAMILIES.map((f) => f.shortLabel)).size).toBe(8)
  })

  it('matches flavorCategories.FLAVOR_AXES exactly, in the same order — the two must never drift apart', () => {
    expect(FLAVOR_FAMILIES.map((f) => f.shortLabel)).toEqual([...FLAVOR_AXES])
  })
})

describe('FLAVOR_DESCRIPTORS', () => {
  it('every legacy NOSE_AROMAS/PALATE_FLAVORS string is present under a real family', () => {
    for (const label of LEGACY_NOSE_PALATE_LABELS) {
      const descriptor = findDescriptor(label)
      expect(descriptor, `expected legacy descriptor "${label}" to still exist`).toBeDefined()
      expect(FLAVOR_FAMILIES.some((f) => f.id === descriptor!.family)).toBe(true)
    }
  })

  it('never lists the same label twice', () => {
    const labels = FLAVOR_DESCRIPTORS.map((d) => d.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('keeps Orange and Orange Peel as two distinct, independent descriptors', () => {
    const orange = findDescriptor('Orange')
    const orangePeel = findDescriptor('Orange Peel')
    expect(orange).toBeDefined()
    expect(orangePeel).toBeDefined()
    expect(orange!.label).not.toBe(orangePeel!.label)
    expect(orangePeel!.aliases).toEqual(expect.arrayContaining(['candied orange']))
  })

  it('resolves every secondary family to a real, different family from the primary', () => {
    for (const descriptor of FLAVOR_DESCRIPTORS) {
      if (!descriptor.secondaryFamily) continue
      expect(descriptor.secondaryFamily).not.toBe(descriptor.family)
      expect(FLAVOR_FAMILIES.some((f) => f.id === descriptor.secondaryFamily)).toBe(true)
    }
  })

  it('the four cross-family duplicates from the source lists each resolve to one primary chip', () => {
    expect(findDescriptor('Praline')).toMatchObject({ family: 'nutty', secondaryFamily: 'sweet' })
    expect(findDescriptor('Nutmeg')).toMatchObject({ family: 'spice', secondaryFamily: 'nutty' })
    expect(findDescriptor('Mint')).toMatchObject({ family: 'herbalFloral', secondaryFamily: 'spice' })
    expect(findDescriptor('Smoke')).toMatchObject({ family: 'smokeEarthy', secondaryFamily: 'oakWood' })
  })
})

describe('FINISH_DESCRIPTORS', () => {
  const expectedLabels = [
    'Short',
    'Medium',
    'Long',
    'Lingering',
    'Warm',
    'Hot',
    'Smooth',
    'Dry',
    'Sweet',
    'Spicy',
    'Oaky',
    'Tannic',
    'Bitter',
    'Clean',
    'Fading',
    'Mouth-Coating',
  ]

  it('matches the specified 16 finish descriptors exactly', () => {
    expect(FINISH_DESCRIPTORS.map((d) => d.label).sort()).toEqual([...expectedLabels].sort())
  })

  it('only maps the genuinely flavor-word finish descriptors to a family', () => {
    expect(findFinishDescriptor('Sweet')?.family).toBe('sweet')
    expect(findFinishDescriptor('Spicy')?.family).toBe('spice')
    expect(findFinishDescriptor('Oaky')?.family).toBe('oakWood')
    expect(findFinishDescriptor('Long')?.family).toBeUndefined()
    expect(findFinishDescriptor('Dry')?.family).toBeUndefined()
  })
})
