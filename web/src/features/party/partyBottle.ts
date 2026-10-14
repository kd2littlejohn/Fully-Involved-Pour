import { bottlePhotoUrl } from '../photoUpload/bottlePhotoUrl'
import type { Bottle } from '../../data/types'
import type { PartyBottle } from './types'

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

// A snapshot of a My Bar bottle for the host-only mapping. Copying the
// details (never a live reference) means picking a bottle never changes
// its inventory, open/sealed status or tasting history.
export function partyBottleFromMyBar(bottle: Bottle): PartyBottle {
  const imageUrl = bottlePhotoUrl(bottle)
  const price = bottle.price ?? bottle.msrp
  return {
    name: bottle.name,
    ...(bottle.distillery ? { distillery: bottle.distillery } : {}),
    ...(bottle.type ? { type: bottle.type } : {}),
    ...(bottle.ageStatement ? { age: bottle.ageStatement } : {}),
    ...(typeof bottle.proof === 'number' ? { proof: bottle.proof } : {}),
    ...(typeof price === 'number' && price > 0 ? { price } : {}),
    ...(imageUrl && imageUrl.startsWith('https://') ? { imageUrl } : {}),
    ...(ID_PATTERN.test(bottle.id) ? { bottleId: bottle.id } : {}),
    source: 'my-bar',
  }
}

export function bottleSummary(bottle: PartyBottle): string {
  return [bottle.distillery, bottle.type, bottle.age, bottle.proof ? `${bottle.proof} proof` : null, bottle.price ? `$${bottle.price}` : null]
    .filter(Boolean)
    .join(' · ')
}
