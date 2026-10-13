import type { Bottle, BottleStatus, Pour } from '../../../data/types'
import { mashBillSummary, parseLocalDate } from '../../../features/bottleDetails/selectors'
import type { FipGuide } from '../../../data/repositories/fipGuide'
import { buyAgainLabel, replaceLabel } from '../../../features/bottleDetails/yourTakeOptions'
import { fipTier } from '../../../features/fip/tiers'
import { bottleJourneyStage } from '../../../features/collection/journeyStage'
import { SpecList, type SpecRow } from '../../../components/ui/SpecList'
import { YourBottlesSection } from '../YourBottlesSection'
import { GalleryTab } from './GalleryTab'
import { confirmedRarityOf } from '../../../features/rarity/rarityFields'
import { RARITY_LABEL, UNCLASSIFIED_LABEL } from '../../../features/rarity/rarityLevels'
import styles from './OverviewTab.module.css'

const STATUS_LABEL: Record<BottleStatus, string> = {
  open: 'Opened',
  sealed: 'Sealed',
  wishlist: 'Wishlist',
  finished: 'Finished',
  incoming: 'Incoming',
}

const FILL_LEVEL_LABEL: Record<string, string> = {
  full: 'Full',
  'three-quarter': 'Three Quarter',
  half: 'Half',
  quarter: 'Quarter',
  empty: 'Empty',
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

interface OverviewTabProps {
  bottle: Bottle
  pours: Pour[]
  guide: FipGuide | undefined
  score: number | undefined
  pourCount: number
  onOpenYourTake: () => void
}

// Overview: a short personal summary, then the bottle's facts, your copy of
// it, notes and photos. Flavor, tasting history and the FIP Guide each have
// their own tab.
export function OverviewTab({ bottle, pours, guide, score, pourCount, onOpenYourTake }: OverviewTabProps) {
  const journeyStage = bottleJourneyStage(bottle)

  // Canonical facts about the bottle itself — the same regardless of who
  // owns it. Release repeats the bottle name deliberately (matches the
  // approved spec-sheet layout); everything else only shows up when real.
  const bottleInfoRows: SpecRow[] = []
  if (bottle.distillery) bottleInfoRows.push({ label: 'Distillery', value: bottle.distillery })
  if (bottle.type) bottleInfoRows.push({ label: 'Type', value: bottle.type })
  const mashBill = mashBillSummary(bottle)
  if (mashBill) bottleInfoRows.push({ label: 'Mash Bill', value: mashBill })
  if (bottle.region) bottleInfoRows.push({ label: 'Region', value: bottle.region })
  bottleInfoRows.push({ label: 'Release', value: bottle.name })
  if (bottle.ageStatement) bottleInfoRows.push({ label: 'Age', value: bottle.ageStatement })
  if (bottle.proof) bottleInfoRows.push({ label: 'Proof', value: bottle.proof })
  // Deliberately "~$" — MSRP is a reference figure, distinct from the exact
  // Price Paid shown in Your Bottle below.
  if (bottle.msrp) bottleInfoRows.push({ label: 'MSRP', value: `~$${Math.round(bottle.msrp)}` })
  // Structured, owner-confirmed classification — placed just above FIP
  // Guide's own free-text `availability` phrase (uncontrolled model prose)
  // so the relationship between the two reads clearly without unifying
  // them. Always shown, including "Unclassified" — never omitted.
  bottleInfoRows.push({ label: 'Rarity', value: confirmedRarityOf(bottle) ? RARITY_LABEL[confirmedRarityOf(bottle)!] : UNCLASSIFIED_LABEL })
  if (guide?.availability) bottleInfoRows.push({ label: 'Availability', value: guide.availability })
  if (bottle.bottleSize) bottleInfoRows.push({ label: 'Bottle Size', value: `${bottle.bottleSize}ml` })

  // Personal/ownership facts — private to this user's copy of the bottle.
  // Status always exists (it's a required field), so this section always
  // has at least one real row to show.
  const yourBottleRows: SpecRow[] = [{ label: 'Status', value: STATUS_LABEL[bottle.status] }]
  if (bottle.purchaseDate) yourBottleRows.push({ label: 'Purchase Date', value: dateFormatter.format(parseLocalDate(bottle.purchaseDate)) })
  if (bottle.price) yourBottleRows.push({ label: 'Price Paid', value: `$${bottle.price.toFixed(2)}` })
  if (bottle.storeLocation) yourBottleRows.push({ label: 'Store', value: bottle.storeLocation })
  if (bottle.openedDate) yourBottleRows.push({ label: 'Opened Date', value: dateFormatter.format(parseLocalDate(bottle.openedDate)) })
  if (bottle.finishedDate) yourBottleRows.push({ label: 'Finish Date', value: dateFormatter.format(parseLocalDate(bottle.finishedDate)) })
  if (bottle.favorite) yourBottleRows.push({ label: 'Favorite', value: '★' })
  if (journeyStage) yourBottleRows.push({ label: 'Bottle Phase', value: journeyStage.label })
  if (typeof bottle.quantity === 'number') yourBottleRows.push({ label: 'Quantity', value: bottle.quantity })
  if (bottle.shelf) yourBottleRows.push({ label: 'Shelf', value: bottle.shelf })
  if (bottle.fillLevel) yourBottleRows.push({ label: 'Fill Level', value: FILL_LEVEL_LABEL[bottle.fillLevel] ?? bottle.fillLevel })

  const tier = typeof score === 'number' ? fipTier(score) : undefined
  const buyAgain = buyAgainLabel(bottle.buyAgain)
  const replace = replaceLabel(bottle.wouldReplace)

  return (
    <>
      <div className={styles.takeCard}>
        <div className={styles.takeHeader}>
          <h3 className={styles.takeTitle}>Your Take</h3>
          <button type="button" className={styles.takeLink} onClick={onOpenYourTake}>
            {pourCount > 0 ? `Based on ${pourCount} ${pourCount === 1 ? 'tasting' : 'tastings'}` : 'Add your take'}
            <span aria-hidden="true"> ›</span>
          </button>
        </div>
        <div className={styles.takeGrid}>
          <div className={styles.takeScore}>
            <div className={styles.takeScoreValue}>
              {typeof score === 'number' ? score.toFixed(1) : '—'}
              <span className={styles.takeScoreMax}> / 10</span>
            </div>
            <div className={styles.takeScoreLabel} style={tier ? { color: tier.color } : undefined}>
              {tier ? tier.label : 'Not rated yet'}
            </div>
          </div>
          <div className={styles.takeFact}>
            <span className={styles.takeFactLabel}>Buy Again</span>
            <span className={buyAgain ? styles.takeFactValue : styles.takeFactEmpty}>{buyAgain ?? 'Not set'}</span>
          </div>
          <div className={styles.takeFact}>
            <span className={styles.takeFactLabel}>Replace It</span>
            <span className={replace ? styles.takeFactValue : styles.takeFactEmpty}>{replace ?? 'Not set'}</span>
          </div>
        </div>
      </div>

      {bottleInfoRows.length > 0 ? (
        <div className={styles.section}>
          <h3 className={styles.heading}>Bottle Info</h3>
          <SpecList rows={bottleInfoRows} />
        </div>
      ) : null}

      <div className={styles.section}>
        <h3 className={styles.heading}>Your Bottle</h3>
        <SpecList rows={yourBottleRows} />
      </div>

      {bottle.instances && bottle.instances.length > 0 ? <YourBottlesSection bottle={bottle} pours={pours} /> : null}

      {bottle.notes ? (
        <div className={styles.section}>
          <h3 className={styles.heading}>Notes</h3>
          <p className={styles.notes}>{bottle.notes}</p>
        </div>
      ) : null}

      <div className={styles.section}>
        <h3 className={styles.heading}>Photos</h3>
        <GalleryTab bottle={bottle} />
      </div>
    </>
  )
}
