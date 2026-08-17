import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { Badge } from '../../components/ui/Badge'
import { FipScoreBadge } from '../../components/ui/FipScoreBadge'
import { StartPourStoryButton } from '../pourWizard/StartPourStoryButton'
import { SecondaryActionCard } from '../../components/ui/SecondaryActionCard'
import { useUserData } from '../../hooks/useUserData'
import { getCurrentScore, getPoursForBottle } from '../bottleDetails/selectors'
import { getRecommendation, type RecommendationResult } from './scoring'
import { MOODS, type MoodId } from './moods'
import { DiceFace } from '../diceRoll/DiceFace'
import type { Bottle, Pour } from '../../data/types'
import styles from './WhatShouldIPourButton.module.css'

const LIGHTBULB_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.45 1.1 1.05 1.1 1.7v.5h5v-.5c0-.65.5-1.25 1.1-1.7A6 6 0 0 0 12 3Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const DAY_MS = 24 * 60 * 60 * 1000
const ROLL_DURATION_MS = 900
const ROLL_TICK_MS = 90
const DIE_FACES = [1, 2, 3, 4, 5, 6]

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
  const [rolling, setRolling] = useState(false)
  const [dieValue, setDieValue] = useState(1)
  const rollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const hasEligibleBottles = userDoc.bottles.some((b) => b.status === 'open' || b.status === 'sealed')

  useEffect(() => {
    return () => {
      if (rollTimer.current) clearInterval(rollTimer.current)
    }
  }, [])

  function handleOpen() {
    if (rollTimer.current) clearInterval(rollTimer.current)
    setMoodId(null)
    setResult(null)
    setShown([])
    setRolling(false)
    setOpen(true)
  }

  function revealMood(id: MoodId) {
    const rec = getRecommendation(userDoc.bottles, userDoc.pours, id)
    setMoodId(id)
    setResult(rec ?? null)
    setShown(rec ? [rec.bottle.id] : [])
  }

  // Surprise Me keeps the fun of Roll the Dice — a quick tumble before the
  // pick lands — instead of resolving instantly like the other moods. Every
  // other mood reveals immediately; only this one animates.
  function pickMood(id: MoodId) {
    if (id !== 'surprise-me') {
      revealMood(id)
      return
    }

    setMoodId('surprise-me')
    setResult(null)
    setRolling(true)
    const startedAt = Date.now()
    rollTimer.current = setInterval(() => {
      setDieValue(DIE_FACES[Math.floor(Math.random() * DIE_FACES.length)] ?? 1)
      if (Date.now() - startedAt >= ROLL_DURATION_MS) {
        if (rollTimer.current) clearInterval(rollTimer.current)
        setRolling(false)
        revealMood('surprise-me')
      }
    }, ROLL_TICK_MS)
  }

  function showAnother() {
    if (!moodId) return
    const rec = getRecommendation(userDoc.bottles, userDoc.pours, moodId, shown)
    setResult(rec ?? null)
    if (rec) setShown((prev) => [...prev, rec.bottle.id])
  }

  function chooseDifferentMood() {
    if (rollTimer.current) clearInterval(rollTimer.current)
    setRolling(false)
    setMoodId(null)
    setResult(null)
    setShown([])
  }

  const rating = result ? getCurrentScore(result.bottle, userDoc.pours) : undefined

  return (
    <>
      <SecondaryActionCard
        icon={LIGHTBULB_ICON}
        title="What Should I Pour?"
        subtitle="Get a recommendation"
        onClick={handleOpen}
      />

      {open ? (
        <Modal title="What Should I Pour?" onClose={() => setOpen(false)}>
          {!hasEligibleBottles ? (
            <EmptyState title="Nothing to recommend yet." message="Add a sealed or opened bottle to your bar first." />
          ) : rolling ? (
            <div className={styles.rollingStep}>
              <DiceFace value={dieValue} size={96} rolling />
              <p className={styles.prompt}>Rolling for tonight&rsquo;s pour…</p>
            </div>
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
