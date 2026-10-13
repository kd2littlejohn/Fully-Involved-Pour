import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { WhatShouldIPourButton } from '../whatShouldIPour/WhatShouldIPourButton'
import { useHomeRecommendation } from './useHomeRecommendation'
import { StartAPourButton } from '../startAPour/StartAPourButton'
import type { Bottle, Pour } from '../../data/types'
import styles from './WhatShouldIPourCard.module.css'
import { bottlePhotoUrl } from '../photoUpload/bottlePhotoUrl'
import { useSommelier } from '../sommelier/SommelierProvider'

interface WhatShouldIPourCardProps {
  uid: string | undefined
  bottles: Bottle[]
  pours: Pour[]
  // Reports the bottle currently featured, so Home can keep it out of Maybe Tonight.
  onPickChange?: (bottleId: string | undefined) => void
}

// Tonight's Pick: Home's primary card. A default "surprise me" pick from the
// same recommendation engine the mood picker uses, persisted per user (see
// useHomeRecommendation) so it survives navigation and re-renders and only
// changes on "Another Pick" or when the bottle stops being pourable.
export function WhatShouldIPourCard({ uid, bottles, pours, onPickChange }: WhatShouldIPourCardProps) {
  const { result, explanation, loaded, showAnother } = useHomeRecommendation(uid, bottles, pours)
  const { openAxe } = useSommelier()
  const pickedId = result?.bottle.id
  useEffect(() => {
    onPickChange?.(pickedId)
  }, [pickedId, onPickChange])

  if (!loaded) return null

  return (
    <section className={styles.card} aria-labelledby="tonights-pick-title">
      <h2 id="tonights-pick-title" className={styles.eyebrow}>
        Tonight&rsquo;s Pick
      </h2>

      {!result ? (
        <p className={styles.emptyText}>Add a sealed or opened bottle to your bar to get a recommendation.</p>
      ) : (
        <>
          <div className={styles.body}>
            <Link to={`/collection/${result.bottle.id}`} className={styles.media} aria-label={`View ${result.bottle.name}`}>
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
              <div className={styles.meta}>
                {[result.bottle.distillery, typeof result.bottle.proof === 'number' ? `${result.bottle.proof} proof` : undefined]
                  .filter(Boolean)
                  .join(' · ')}
                {result.bottle.status === 'sealed' ? <span className={styles.sealed}>Sealed</span> : null}
              </div>
              <p className={styles.reason}>{explanation || result.reasons.join(' ')}</p>
            </div>
          </div>

          <div className={styles.actions}>
            <StartAPourButton bottleId={result.bottle.id} label="Pour This" />
            <Button variant="secondary" onClick={showAnother}>
              Another Pick
            </Button>
          </div>

          <div className={styles.links}>
            {/* Explains the pick already on screen; opening AXE never re-rolls it. */}
            <button
              type="button"
              className={styles.askAxe}
              aria-haspopup="dialog"
              onClick={() =>
                openAxe({
                  screen: 'pour-recommendation',
                  bottleId: result.bottle.id,
                  facts: [...result.reasons, ...result.tags.map((tag) => `Signal: ${tag}`)],
                })
              }
            >
              Ask AXE why
            </button>
            <WhatShouldIPourButton trigger="link" />
          </div>
        </>
      )}
    </section>
  )
}
