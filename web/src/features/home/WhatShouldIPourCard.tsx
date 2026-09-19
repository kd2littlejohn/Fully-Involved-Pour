import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { WhatShouldIPourButton } from '../whatShouldIPour/WhatShouldIPourButton'
import { getRecommendation, type RecommendationResult } from '../whatShouldIPour/scoring'
import { explainPourRecommendation } from '../../data/repositories/pourRecommendationExplanation'
import { StartAPourButton } from '../startAPour/StartAPourButton'
import type { Bottle, Pour } from '../../data/types'
import styles from './WhatShouldIPourCard.module.css'

interface WhatShouldIPourCardProps {
  bottles: Bottle[]
  pours: Pour[]
}

// The dashboard's primary card — a default "surprise me" pick from the same
// recommendation engine WhatShouldIPourButton's mood picker uses, shown
// inline instead of behind a click. The mood picker itself stays reachable
// underneath for anyone who wants to steer it, rather than duplicating that
// UI here.
export function WhatShouldIPourCard({ bottles, pours }: WhatShouldIPourCardProps) {
  const [result, setResult] = useState<RecommendationResult | null | undefined>(undefined)
  const [shown, setShown] = useState<string[]>([])
  const [explanation, setExplanation] = useState<string | undefined>(undefined)

  useEffect(() => {
    const rec = getRecommendation(bottles, pours, 'surprise-me') ?? null
    setResult(rec)
    setShown(rec ? [rec.bottle.id] : [])
    // Only ever picks once per Home mount — "Show Me Another" below handles
    // every subsequent pick without re-running this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    setExplanation(undefined)
    if (!result) return
    let cancelled = false
    explainPourRecommendation({
      bottleName: result.bottle.name,
      distillery: result.bottle.distillery,
      type: result.bottle.type,
      moodLabel: 'tonight',
      reasons: result.reasons,
      tags: result.tags,
    })
      .then((text) => {
        if (!cancelled && text) setExplanation(text)
      })
      .catch((err: unknown) => {
        console.error('[WhatShouldIPourCard] explainPourRecommendation failed', { bottleId: result.bottle.id, err })
      })
    return () => {
      cancelled = true
    }
  }, [result])

  function showAnother() {
    const rec = getRecommendation(bottles, pours, 'surprise-me', shown) ?? null
    setResult(rec)
    if (rec) setShown((prev) => [...prev, rec.bottle.id])
  }

  if (result === undefined) return null

  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>What Should I Pour?</div>

      {!result ? (
        <p className={styles.emptyText}>Add a sealed or opened bottle to your bar to get a recommendation.</p>
      ) : (
        <>
          <div className={styles.body}>
            <Link to={`/collection/${result.bottle.id}`} className={styles.media}>
              {result.bottle.imageUrl ? (
                <img className={styles.image} src={result.bottle.imageUrl} alt="" />
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
