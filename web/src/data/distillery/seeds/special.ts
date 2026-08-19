import type { DistillerySeed } from '../types'

// Non-geographic sourcing options for whiskey whose distillery of origin
// isn't a named place — Ross & Squibb is a real, physical distillery
// (formerly MGP's beverage-alcohol operation) so it gets full location
// data; the other three are intentionally placeholder concepts, not real
// distilleries, so they carry no city/state/country/verified=true. Never
// invent a real distillery name when the source is genuinely unknown —
// these three exist so the UI never has to.
export const SPECIAL_SOURCE_SEEDS: DistillerySeed[] = [
  {
    name: 'Ross & Squibb Distillery',
    aliases: ['Ross & Squibb', 'MGP', 'MGP Indiana', 'Midwest Grain Products', 'Seagram’s Lawrenceburg'],
    city: 'Lawrenceburg',
    stateProvince: 'Indiana',
    country: 'United States',
    verified: true,
  },
  { name: 'Undisclosed Source', verified: false },
  { name: 'Contract Distilled', verified: false },
  { name: 'Unknown Distillery', aliases: ['Unknown'], verified: false },
]
