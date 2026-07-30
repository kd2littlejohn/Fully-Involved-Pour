import type { Bottle, Pour } from '../../data/types'
import { RadarChart } from '../../components/ui/RadarChart'
import { FLAVOR_AXES, flavorRadarValues } from './flavorCategories'
import styles from './FlavorRadar.module.css'

export function FlavorRadar({ bottle, pours }: { bottle: Bottle; pours: Pour[] }) {
  const values = flavorRadarValues(bottle, pours)
  if (!values) return null

  return (
    <div className={styles.wrap}>
      <RadarChart axes={[...FLAVOR_AXES]} series={[{ label: bottle.name, color: 'var(--fip-amber)', values }]} size={200} />
    </div>
  )
}
