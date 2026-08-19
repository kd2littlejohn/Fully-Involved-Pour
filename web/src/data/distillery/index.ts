import { buildDistilleries } from './build'
import { US_DISTILLERY_SEEDS } from './seeds/unitedStates'
import { SCOTLAND_DISTILLERY_SEEDS } from './seeds/scotland'
import { IRELAND_DISTILLERY_SEEDS } from './seeds/ireland'
import { CANADA_DISTILLERY_SEEDS } from './seeds/canada'
import { JAPAN_DISTILLERY_SEEDS } from './seeds/japan'
import { INDIA_DISTILLERY_SEEDS } from './seeds/india'
import { AUSTRALIA_DISTILLERY_SEEDS } from './seeds/australia'
import { TAIWAN_DISTILLERY_SEEDS } from './seeds/taiwan'
import { ENGLAND_DISTILLERY_SEEDS } from './seeds/england'
import { WALES_DISTILLERY_SEEDS } from './seeds/wales'
import { FRANCE_DISTILLERY_SEEDS } from './seeds/france'
import { OTHER_DISTILLERY_SEEDS } from './seeds/other'
import { SPECIAL_SOURCE_SEEDS } from './seeds/special'

export type { Distillery, DistillerySeed, DistilleryStatus } from './types'
export { normalizeDistilleryName } from './build'

// The single canonical list every consumer (search, Add Bottle combobox,
// bottle-lookup matching) reads from — reseed by editing the per-country
// files under seeds/, never by editing this array directly.
export const DISTILLERIES = buildDistilleries([
  ...US_DISTILLERY_SEEDS,
  ...SCOTLAND_DISTILLERY_SEEDS,
  ...IRELAND_DISTILLERY_SEEDS,
  ...CANADA_DISTILLERY_SEEDS,
  ...JAPAN_DISTILLERY_SEEDS,
  ...INDIA_DISTILLERY_SEEDS,
  ...AUSTRALIA_DISTILLERY_SEEDS,
  ...TAIWAN_DISTILLERY_SEEDS,
  ...ENGLAND_DISTILLERY_SEEDS,
  ...WALES_DISTILLERY_SEEDS,
  ...FRANCE_DISTILLERY_SEEDS,
  ...OTHER_DISTILLERY_SEEDS,
  ...SPECIAL_SOURCE_SEEDS,
])
