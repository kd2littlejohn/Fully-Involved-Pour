import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { Badge } from '../../components/ui/Badge'
import { FipScoreBadge } from '../../components/ui/FipScoreBadge'
import { StartPourStoryButton } from '../pourWizard/StartPourStoryButton'
import { useUserData } from '../../hooks/useUserData'
import { getCurrentScore, getPoursForBottle } from '../bottleDetails/selectors'
import { getRecommendation, type RecommendationResult } from './scoring'
import { MOODS, type MoodId } from './moods'
import type { Bottle, Pour } from '../../data/types'
import styles from './WhatShouldIPourButton.module.css'

const DAY_MS = 24 * 60 * 60 * 1000

// Never claims a prior pour that didn't happen — a sealed or never-poured
// bottle gets an honest "not yet" statement instead of a fabricated stat.
function formatLastPoured(bottle: Bottle, pours: Pour[]): string {
  const [latest] = getPoursForBottle(pours, bottle.id)
  if (!latest) {
    return bottle.status === 'sealed' ? 'Still sealed — not yet poured' : "You haven't logged a pour yet"
  }
  const days = Math.round((Date.now() - new Date(latest.date).getTime()) / DAY_MS)
  if (days <= 0) return 'Poured today'
  if (days === 1) return 'Last poured yesterday'
  return `Last poured ${days} days ago`
}

export function WhatShouldIPourButton() {
  const { userDoc } = useUserData()
  const [open, setOpen] = useState(false)
  const [moodId, setMoodId] = useState<MoodId | null>(null)
  const [result, setResult] = useState<RecommendationResult | null>(null)
  const [shown, setShown] = useState<string[]>([])

  const hasEligibleBottles = userDoc.bottles.some((b) => b.status === 'open' || b.status === 'sealed')

  function handleOpen() {
    setMoodId(null)
    setResult(null)
    setShown([])
    setOpen(true)
  }

  function pickMood(id: MoodId) {
    const rec = getRecommendation(userDoc.bottles, userDoc.pours, id)
    setMoodId(id)
    setResult(rec ?? null)
    setShown(rec ? [rec.bottle.id] : [])
  }

  function showAnother() {
    if (!moodId) return
    const rec = getRecommendation(userDoc.bottles, userDoc.pours, moodId, shown)
    setResult(rec ?? null)
    if (rec) setShown((prev) => [...prev, rec.bottle.id])
  }

  function chooseDifferentMood() {
    setMoodId(null)
    setResult(null)
    setShown([])
  }

  const rating = result ? getCurrentScore(result.bottle, userDoc.pours) : undefined

  return (
    <>
      <Button onClick={handleOpen}>What Should I Pour?</Button>

      {open ? (
        <Modal title="What Should I Pour?" onClose={() => setOpen(false)}>
          {!hasEligibleBottles ? (
            <EmptyState title="Nothing to recommend yet." message="Add a sealed or opened bottle to your collection first." />
          ) : !moodId || !result ? (
            <div className={styles.moodStep}>
              <p className={styles.prompt}>What are you in the mood for?</p>
              <div className={styles.moodGrid}>
                {MOODS.map((mood) => (
                  <button key={mood.id} type="button" className={styles.moodButton} onClick={() => pickMood(mood.id)}>
                    {mood.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.result}>
              <div className={styles.eyebrow}>Tonight&rsquo;s Pour</div>

              <div className={styles.imageWrap}>
                {result.bottle.imageUrl ? (
                  <img className={styles.image} src={result.bottle.imageUrl} alt="" />
                ) : (
                  <BottlePlaceholder name={result.bottle.name} />
                )}
              </div>

              <div className={styles.name}>{result.bottle.name}</div>
              {result.bottle.distillery ? <div className={styles.distillery}>{result.bottle.distillery}</div> : null}

              {result.bottle.status === 'sealed' ? <Badge tone="amber">Sealed — opening a new bottle</Badge> : null}

              <div className={styles.stats}>
                {typeof rating === 'number' ? (
                  <div className={styles.statBlock}>
                    <FipScoreBadge score={rating} />
                    <span className={styles.statLabel}>Your Rating</span>
                  </div>
                ) : null}
                <div className={styles.statBlock}>
                  <span className={styles.statValue}>{formatLastPoured(result.bottle, userDoc.pours)}</span>
                </div>
              </div>

              <div className={styles.why}>
                <div className={styles.whyLabel}>Why this one?</div>
                <p className={styles.whyText}>{result.reasons.join(' ')}</p>
              </div>

              <div className={styles.actions}>
                <StartPourStoryButton bottleId={result.bottle.id} label="Pour This" />
                <Button variant="ghost" onClick={showAnother}>
                  Show Me Another
                </Button>
              </div>

              <button type="button" className={styles.backLink} onClick={chooseDifferentMood}>
                Choose a different mood
              </button>
            </div>
          )}
        </Modal>
      ) : null}
    </>
  )
}
