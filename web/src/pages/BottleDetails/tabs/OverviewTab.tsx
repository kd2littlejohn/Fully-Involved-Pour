import type { Bottle, BottleStatus, Pour } from '../../../data/types'
import { mashBillSummary, parseLocalDate } from '../../../features/bottleDetails/selectors'
import { useFipGuide } from '../../../features/bottleDetails/useFipGuide'
import { FipGuideSection } from '../../../features/bottleDetails/FipGuideSection'
import { bottleJourneyStage } from '../../../features/collection/journeyStage'
import { SpecList, type SpecRow } from '../../../components/ui/SpecList'
import { Badge } from '../../../components/ui/Badge'
import { FlavorRadar } from '../../../features/flavorRadar/FlavorRadar'
import { flavorRadarValues } from '../../../features/flavorRadar/flavorCategories'
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

export function OverviewTab({ bottle, pours }: { bottle: Bottle; pours: Pour[] }) {
  const { state: guideState, guide } = useFipGuide(bottle)
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

  const radarValues = flavorRadarValues(bottle, pours)

  return (
    <>
      <FipGuideSection state={guideState} guide={guide} />

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

      {radarValues ? (
        <div className={styles.section}>
          <h3 className={styles.heading}>Your Flavor Profile</h3>
          <FlavorRadar bottle={bottle} pours={pours} />
        </div>
      ) : null}

      {bottle.flavors && bottle.flavors.length > 0 ? (
        <div className={styles.section}>
          <h3 className={styles.heading}>Flavor Notes</h3>
          <div className={styles.chips}>
            {bottle.flavors.map((flavor) => (
              <Badge key={flavor} tone="brass">
                {flavor}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {bottle.notes ? (
        <div className={styles.section}>
          <h3 className={styles.heading}>Notes</h3>
          <p className={styles.notes}>{bottle.notes}</p>
        </div>
      ) : null}
    </>
  )
}
