import type { Bottle, Pour } from '../../../data/types'
import { mashBillSummary } from '../../../features/bottleDetails/selectors'
import { SpecList, type SpecRow } from '../../../components/ui/SpecList'
import { Badge } from '../../../components/ui/Badge'
import { EmptyState } from '../../../components/ui/EmptyState'
import { FlavorRadar } from '../../../features/flavorRadar/FlavorRadar'
import { flavorRadarValues } from '../../../features/flavorRadar/flavorCategories'
import styles from './OverviewTab.module.css'

const FILL_LEVEL_LABEL: Record<string, string> = {
  full: 'Full',
  'three-quarter': 'Three Quarter',
  half: 'Half',
  quarter: 'Quarter',
  empty: 'Empty',
}

export function OverviewTab({ bottle, pours }: { bottle: Bottle; pours: Pour[] }) {
  const rows: SpecRow[] = []

  if (bottle.type) rows.push({ label: 'Type', value: bottle.type })
  if (bottle.region) rows.push({ label: 'Region', value: bottle.region })
  if (bottle.proof) rows.push({ label: 'Proof', value: bottle.proof })
  if (bottle.ageStatement) rows.push({ label: 'Age', value: bottle.ageStatement })
  const mashBill = mashBillSummary(bottle)
  if (mashBill) rows.push({ label: 'Mash Bill', value: mashBill })
  if (bottle.price) rows.push({ label: 'Price Paid', value: `$${bottle.price.toFixed(2)}` })
  if (bottle.msrp) rows.push({ label: 'MSRP', value: `$${bottle.msrp.toFixed(2)}` })
  if (bottle.bottleSize) rows.push({ label: 'Bottle Size', value: `${bottle.bottleSize}ml` })
  if (bottle.fillLevel) rows.push({ label: 'Fill Level', value: FILL_LEVEL_LABEL[bottle.fillLevel] ?? bottle.fillLevel })
  if (typeof bottle.quantity === 'number') rows.push({ label: 'Quantity', value: bottle.quantity })
  if (bottle.storeLocation) rows.push({ label: 'Store', value: bottle.storeLocation })
  if (bottle.shelf) rows.push({ label: 'Shelf', value: bottle.shelf })

  const radarValues = flavorRadarValues(bottle, pours)

  if (rows.length === 0 && !bottle.notes && (bottle.flavors?.length ?? 0) === 0 && !radarValues) {
    return <EmptyState title="No details added yet." message="Edit this bottle to add proof, price, mash bill, and more." />
  }

  return (
    <>
      {radarValues ? (
        <div className={styles.section}>
          <h3 className={styles.heading}>Flavor Profile</h3>
          <FlavorRadar bottle={bottle} pours={pours} />
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className={styles.section}>
          <SpecList rows={rows} />
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
