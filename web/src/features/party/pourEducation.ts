// "Learn About This Pour" for Dual Experience guided tasters: general,
// well-established style education matched from the bottle's own type and
// the round's name. It describes the STYLE, never claims anything about a
// specific bottle, so it can't invent tasting notes or facts. Pure, so the
// matching is tested directly (pourEducation.test.ts).
import type { PartyPublicBottle } from './types'

export interface PourEducation {
  style: string
  grain: string
  barrel: string
  aroma: string
  descriptors: string[]
  tip?: string
}

interface StyleEntry extends Omit<PourEducation, 'tip'> {
  match: RegExp
}

const NEW_CHARRED_OAK =
  'Aged in new charred oak, which gives American whiskey most of its color and its caramel, vanilla and toasted-oak sweetness.'

// Most specific first: a "Double Oaked Wheated Bourbon" is taught as double
// oaked, since that's what the round is usually about.
const STYLES: StyleEntry[] = [
  {
    match: /double[\s-]*(oak|barrel)|twice[\s-]*barrel/,
    style: 'Double oaked',
    grain: 'Usually a bourbon mash bill: mostly corn for sweetness, with rye or wheat for character.',
    barrel:
      'Aged once in new charred oak, then moved into a second new barrel, often heavily toasted and lightly charred, for a few more months. The second barrel adds deeper oak and sweetness quickly.',
    aroma: 'Expect rich caramel, toasted oak and baking spice, sometimes dark chocolate or molasses.',
    descriptors: ['Dark caramel', 'Toasted oak', 'Chocolate', 'Molasses', 'Clove', 'Vanilla'],
  },
  {
    match: /toast/,
    style: 'Toasted barrel',
    grain: 'Usually a bourbon or rye mash bill.',
    barrel: 'Finished in (or aged in) barrels that were toasted with slow heat rather than only charred, which draws out sweet wood sugars.',
    aroma: 'Look for toasted marshmallow, brown sugar, vanilla and gentle oak.',
    descriptors: ['Toasted marshmallow', 'Brown sugar', 'Vanilla', 'Toasted oak', 'Nutmeg'],
  },
  {
    match: /\b(finish|finished|port|sherry|wine|rum|cognac|madeira|mizunara)\b/,
    style: 'Finished whiskey',
    grain: 'Starts as a finished whiskey of its own style (often bourbon or rye).',
    barrel: 'Spends extra time in a second cask that held something else, such as wine, port, sherry or rum, which layers that cask’s character over the whiskey.',
    aroma: 'Expect the base whiskey plus fruit from the finishing cask: dried fruit, berries, wine or tropical notes.',
    descriptors: ['Dried fruit', 'Red berries', 'Raisin', 'Brown sugar', 'Oak', 'Spice'],
  },
  {
    match: /wheat/,
    style: 'Wheated bourbon',
    grain: 'Wheat replaces rye as the flavoring grain alongside corn, softening the spice and adding bready, honeyed sweetness.',
    barrel: `${NEW_CHARRED_OAK} The gentler grain lets that sweetness lead.`,
    aroma: 'Look for caramel, honey, fresh bread, vanilla and soft red fruit.',
    descriptors: ['Caramel', 'Honey', 'Bread', 'Vanilla', 'Toffee', 'Cherry'],
  },
  {
    match: /high[\s-]*rye/,
    style: 'High-rye bourbon',
    grain: 'Still mostly corn, but with a large share of rye, which adds pepper, herbs and spice to the corn’s sweetness.',
    barrel: NEW_CHARRED_OAK,
    aroma: 'Expect caramel and vanilla with a peppery, spicy lift and some herbal or mint notes.',
    descriptors: ['Caramel', 'Black pepper', 'Cinnamon', 'Mint', 'Vanilla', 'Orange peel'],
  },
  {
    match: /\brye\b/,
    style: 'Rye whiskey',
    grain: 'American rye is made from at least 51% rye, which brings peppery spice, herbal and grassy notes, and a drier finish than bourbon.',
    barrel: NEW_CHARRED_OAK,
    aroma: 'Look for black pepper, mint, dill, baking spice and dark fruit.',
    descriptors: ['Black pepper', 'Mint', 'Dill', 'Clove', 'Rye bread', 'Dark cherry'],
  },
  {
    match: /bottled[\s-]*in[\s-]*bond|\bbib\b|\bbonded\b/,
    style: 'Bottled in Bond',
    grain: 'Any American whiskey style; bourbon and rye are the most common.',
    barrel:
      'By law it comes from one distillery and one distilling season, ages at least four years in a bonded warehouse, and is bottled at exactly 100 proof.',
    aroma: 'Expect a fuller, more concentrated version of its style, with noticeable oak from four or more years in the barrel.',
    descriptors: ['Caramel', 'Oak', 'Vanilla', 'Baking spice', 'Toffee'],
  },
  {
    match: /barrel[\s-]*proof|cask[\s-]*strength|full[\s-]*proof|uncut|barrel[\s-]*strength/,
    style: 'Barrel proof',
    grain: 'Any style; the difference is how little water is added before bottling.',
    barrel: 'Bottled at or near the strength it came out of the barrel, so the oak and grain flavors are concentrated and the heat is higher.',
    aroma: 'Expect intense caramel, oak and spice. Let it rest and nose it gently.',
    descriptors: ['Rich caramel', 'Oak', 'Baking spice', 'Dark fruit', 'Heat'],
  },
  {
    match: /single[\s-]*barrel/,
    style: 'Single barrel',
    grain: 'Any style; every bottle comes from one barrel, not a blend.',
    barrel: 'Each barrel ages a little differently depending on where it sat in the warehouse, so two bottles of the same name can taste noticeably different.',
    aroma: 'Expect the classic notes of its style, with this barrel’s own personality.',
    descriptors: ['Caramel', 'Vanilla', 'Oak', 'Spice', 'Fruit'],
  },
  {
    match: /small[\s-]*batch/,
    style: 'Small batch',
    grain: 'Any style. “Small batch” has no legal definition; it means a limited number of selected barrels blended together.',
    barrel: NEW_CHARRED_OAK,
    aroma: 'Expect a balanced, house-style version of its whiskey.',
    descriptors: ['Caramel', 'Vanilla', 'Oak', 'Baking spice', 'Honey'],
  },
  {
    match: /tennessee/,
    style: 'Tennessee whiskey',
    grain: 'Made like bourbon (mostly corn), then filtered through sugar-maple charcoal before aging (the Lincoln County Process).',
    barrel: NEW_CHARRED_OAK,
    aroma: 'Look for banana, caramel, vanilla and a soft, sooty sweetness.',
    descriptors: ['Banana', 'Caramel', 'Vanilla', 'Toasted oak', 'Brown sugar'],
  },
  {
    match: /american[\s-]*single[\s-]*malt/,
    style: 'American single malt',
    grain: '100% malted barley from one distillery, which gives cereal, biscuit and fruit notes.',
    barrel: 'Often aged in new oak, used casks or both, depending on the distillery.',
    aroma: 'Look for malt, biscuit, honey, orchard fruit and oak.',
    descriptors: ['Malt', 'Biscuit', 'Honey', 'Pear', 'Oak'],
  },
  {
    match: /scotch|islay|speyside|highland|single[\s-]*malt|\bpeat/,
    style: 'Scotch whisky',
    grain: 'Single malts use only malted barley; some distilleries dry the barley over peat smoke for a smoky character.',
    barrel: 'Aged at least three years in oak, usually casks that previously held bourbon or sherry, which flavor it more gently than new oak.',
    aroma: 'Depending on the style: honey, orchard fruit and malt, sherried dried fruit, or smoke and sea spray.',
    descriptors: ['Malt', 'Honey', 'Dried fruit', 'Smoke', 'Heather', 'Citrus'],
  },
  {
    match: /irish/,
    style: 'Irish whiskey',
    grain: 'Often a blend of grains; single pot still Irish whiskey mixes malted and unmalted barley for a creamy, spicy texture.',
    barrel: 'Aged at least three years in wooden casks, often ex-bourbon or sherry.',
    aroma: 'Look for orchard fruit, honey, vanilla and a soft spice.',
    descriptors: ['Green apple', 'Honey', 'Vanilla', 'Spice', 'Cream'],
  },
  {
    match: /japan/,
    style: 'Japanese whisky',
    grain: 'Often malt whisky, grain whisky or a blend of the two.',
    barrel: 'Aged in a range of casks, sometimes including Japanese mizunara oak.',
    aroma: 'Look for delicate fruit, honey, malt and gentle oak.',
    descriptors: ['Honey', 'Pear', 'Malt', 'Sandalwood', 'Citrus'],
  },
  {
    match: /bourbon/,
    style: 'Bourbon',
    grain: 'Made in the United States from at least 51% corn, which brings sweetness, usually with rye or wheat and malted barley.',
    barrel: NEW_CHARRED_OAK,
    aroma: 'Look for caramel, vanilla, toasted oak, baking spice and cherry.',
    descriptors: ['Caramel', 'Vanilla', 'Oak', 'Baking spice', 'Cherry', 'Honey'],
  },
]

const GENERAL: StyleEntry = {
  match: /.*/,
  style: 'Whiskey',
  grain: 'Whiskey’s grains set its base flavor: corn tends toward sweetness, rye toward spice, wheat toward softness and malted barley toward cereal and fruit.',
  barrel: 'Time in oak adds color and much of the flavor: vanilla, caramel, spice and toasted wood.',
  aroma: 'Nose gently, then sip. Look for sweet, spicy, fruity and oaky notes.',
  descriptors: ['Caramel', 'Vanilla', 'Oak', 'Spice', 'Fruit'],
}

// The style guide for one guided pour: the most specific style named by
// the bottle's type, its name or the round's name, so a Weller typed just
// "Bourbon" in a round called "Wheated" still teaches wheated bourbon.
export function pourEducation(bottle: Pick<PartyPublicBottle, 'name' | 'type' | 'proof'>, categoryName = ''): PourEducation {
  const text = [bottle.type ?? '', bottle.name ?? '', categoryName].map((s) => s.toLowerCase())
  const entry = STYLES.find((style) => text.some((source) => style.match.test(source))) ?? GENERAL
  const { match: _match, ...education } = entry
  const tip =
    typeof bottle.proof === 'number' && bottle.proof >= 110
      ? `At ${bottle.proof} proof, try a few drops of water after your first sip. It can open up the aroma.`
      : undefined
  return { ...education, ...(tip ? { tip } : {}) }
}
