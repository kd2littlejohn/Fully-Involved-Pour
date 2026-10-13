import type { Bottle, Pour } from '../../../data/types'
import type { FipGuide } from '../../../data/repositories/fipGuide'
import type { FipGuideLoadState } from '../../../features/bottleDetails/useFipGuide'
import { FipGuideSection } from '../../../features/bottleDetails/FipGuideSection'
import { FlavorRadar } from '../../../features/flavorRadar/FlavorRadar'
import { flavorRadarValues } from '../../../features/flavorRadar/flavorCategories'
import { PalateMatchBadge } from '../../../features/palateMatch/PalateMatchBadge'
import { Badge } from '../../../components/ui/Badge'
import { CompareTab } from './CompareTab'
import styles from './FlavorProfileTab.module.css'

interface FlavorProfileTabProps {
  bottle: Bottle
  pours: Pour[]
  otherBottles: Bottle[]
  guideState: FipGuideLoadState
  guide: FipGuide | undefined
}

// Flavor Profile keeps personal and reference data visibly apart:
// "Yours" is built only from the user's own tastings and notes; "Typical"
// is the FIP Guide's general reference profile for the bottle.
export function FlavorProfileTab({ bottle, pours, otherBottles, guideState, guide }: FlavorProfileTabProps) {
  const radarValues = flavorRadarValues(bottle, pours)
  const flavors = bottle.flavors ?? []
  const hasPersonal = Boolean(radarValues) || flavors.length > 0

  return (
    <>
      <PalateMatchBadge bottle={bottle} />

      <section className={styles.section} aria-labelledby="flavor-yours-title">
        <h3 id="flavor-yours-title" className={styles.heading}>
          Your Flavor Profile <span className={styles.tag}>From your tastings</span>
        </h3>
        {radarValues ? <FlavorRadar bottle={bottle} pours={pours} /> : null}
        {flavors.length > 0 ? (
          <div className={styles.notes}>
            <p className={styles.subheading}>Flavor Notes</p>
            <div className={styles.chips}>
              {flavors.map((flavor) => (
                <Badge key={flavor} tone="brass">
                  {flavor}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
        {!hasPersonal ? <p className={styles.empty}>Log a tasting with flavor notes and your own profile for this bottle will appear here.</p> : null}
      </section>

      <FipGuideSection state={guideState} guide={guide} part="profile" />

      <section className={styles.section} aria-labelledby="flavor-compare-title">
        <h3 id="flavor-compare-title" className={styles.heading}>
          Compare
        </h3>
        <CompareTab bottle={bottle} otherBottles={otherBottles} pours={pours} />
      </section>
    </>
  )
}
