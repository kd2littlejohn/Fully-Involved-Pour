import { describe, expect, it } from 'vitest'
import { bottlePhotoUrl } from './bottlePhotoUrl'

describe('bottlePhotoUrl', () => {
  it('prefers the untouched original over the standardized (backdrop-baked) display image', () => {
    expect(bottlePhotoUrl({ imageUrl: 'std.jpg', originalImageUrl: 'orig.jpg' })).toBe('orig.jpg')
  })

  it('falls back to imageUrl for photos saved before originals were kept', () => {
    expect(bottlePhotoUrl({ imageUrl: 'legacy.jpg' })).toBe('legacy.jpg')
  })

  it('returns undefined when the bottle has no photo at all', () => {
    expect(bottlePhotoUrl({})).toBeUndefined()
    expect(bottlePhotoUrl({ imageUrl: '', originalImageUrl: '' })).toBeUndefined()
  })
})
