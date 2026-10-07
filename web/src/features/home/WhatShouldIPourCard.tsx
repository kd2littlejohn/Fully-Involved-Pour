import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { WhatShouldIPourButton } from '../whatShouldIPour/WhatShouldIPourButton'
import { useHomeRecommendation } from './useHomeRecommendation'
import { StartAPourButton } from '../startAPour/StartAPourButton'
import type { Bottle, Pour } from '../../data/types'
import styles from './WhatShouldIPourCard.module.css'
import { bottlePhotoUrl } from '../photoUpload/bottlePhotoUrl'

interface WhatShouldIPourCardProps {
  uid: string | undefined
  bottles: Bottle[]
  pours: Pour[]
}

// The dashboard's primary card — a default "surprise me" pick from the same
// recommendation engine WhatShouldIPourButton's mood picker uses, shown
// inline instead of behind a click. The mood picker itself stays reachable
// underneath for anyone who wants to steer it, rather than duplicating that
// UI here. The pick itself is persisted per-user (see useHomeRecommendation)
// so it survives navigating away and back, not just re-renders.
export function WhatShouldIPourCard({ uid, bottles, pours }: WhatShouldIPourCardProps) {
  const { result, explanation, loaded, showAnother } = useHomeRecommendation(uid, bottles, pours)

  if (!loaded) return null

  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>What Should I Pour?</div>

      {!result ? (
        <p className={styles.emptyText}>Add a sealed or opened bottle to your bar to get a recommendation.</p>
      ) : (
        <>
          <div className={styles.body}>
            <Link to={`/collection/${result.bottle.id}`} className={styles.media}>
              {bottlePhotoUrl(result.bottle) ? (
                <img className={styles.image} src={bottlePhotoUrl(result.bottle)} alt="" />
              ) : (
                <BottlePlaceholder name={result.bottle.name} />
              )}
            </Link>
            <div className={styles.info}>
              <Link to={`/collection/${result.bottle.id}`} className={styles.name}>
                {result.bottle.name}
              </Link>
              {result.bottle.distillery ? <div className={styles.distillery}>{result.bottle.distillery}</div> : null}
              <p className={styles.reason}>{explanation ?? result.reasons.join(' ')}</p>
            </div>
          </div>

          <div className={styles.actions}>
            <StartAPourButton bottleId={result.bottle.id} label="Pour This" />
            <Link to={`/collection/${result.bottle.id}`}>
              <Button variant="secondary">View Bottle</Button>
            </Link>
            <Button variant="ghost" onClick={showAnother}>
              Show Me Another
            </Button>
          </div>
        </>
      )}

      <div className={styles.moodPicker}>
        <WhatShouldIPourButton />
      </div>
    </div>
  )
}
