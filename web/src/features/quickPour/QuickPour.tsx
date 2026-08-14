import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { TapChip } from '../../components/ui/TapChip'
import { useUserData } from '../../hooks/useUserData'
import { PALATE_FLAVORS } from '../fip/scoring'
import { QUICK_POUR_REACTIONS, type QuickPourReaction } from './reactions'
import { buildQuickPourInput } from './buildQuickPourInput'
import styles from './QuickPour.module.css'

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

interface QuickPourProps {
  bottleId: string
  bottleName: string
  onClose: () => void
  onSaved?: () => void
}

// The fast alternate to the full 6-step wizard: reaction -> optional flavor
// tags -> optional score nudge -> save. A user who just wants the moment
// captured can be done in two taps; the full wizard is still there (see
// StartPourStoryButton) for anyone who wants the deep tasting breakdown.
export function QuickPour({ bottleId, bottleName, onClose, onSaved }: QuickPourProps) {
  const { addPour } = useUserData()
  const [reaction, setReaction] = useState<QuickPourReaction | null>(null)
  const [flavors, setFlavors] = useState<string[]>([])
  const [score, setScore] = useState<number | null>(null)
  const [adjusting, setAdjusting] = useState(false)
  const [saving, setSaving] = useState(false)

  function pickReaction(next: QuickPourReaction) {
    setReaction(next)
    setScore(next.score)
  }

  function toggleFlavor(flavor: string) {
    setFlavors((prev) => (prev.includes(flavor) ? prev.filter((f) => f !== flavor) : [...prev, flavor]))
  }

  async function handleSave() {
    if (!reaction || score == null || saving) return
    setSaving(true)
    await addPour(buildQuickPourInput({ bottleId, date: todayIsoDate(), reactionLabel: reaction.label, score, flavors }))
    setSaving(false)
    onSaved?.()
    onClose()
  }

  const displayedScore = score ?? reaction?.score ?? 0

  return (
    <Modal title={`Quick Pour — ${bottleName}`} onClose={onClose}>
      <p className={styles.prompt}>How's this pour treating you?</p>
      <div className={styles.reactionRow}>
        {QUICK_POUR_REACTIONS.map((r) => (
          <button
            key={r.value}
            type="button"
            className={reaction?.value === r.value ? `${styles.reaction} ${styles.reactionActive}` : styles.reaction}
            aria-pressed={reaction?.value === r.value}
            onClick={() => pickReaction(r)}
          >
            <span className={styles.reactionEmoji} aria-hidden="true">
              {r.emoji}
            </span>
            {r.label}
          </button>
        ))}
      </div>

      {reaction ? (
        <>
          <p className={styles.prompt}>What stands out? (optional)</p>
          <div className={styles.chipRow}>
            {PALATE_FLAVORS.map((flavor) => (
              <TapChip key={flavor} label={flavor} active={flavors.includes(flavor)} onToggle={() => toggleFlavor(flavor)} />
            ))}
          </div>

          <div className={styles.scoreRow}>
            <span className={styles.scoreLabel}>Score</span>
            {adjusting ? (
              <input
                type="range"
                min={0}
                max={10}
                step={0.1}
                value={displayedScore}
                onChange={(e) => setScore(Number(e.target.value))}
                aria-label="Adjust score"
                className={styles.scoreSlider}
              />
            ) : null}
            <span className={styles.scoreValue}>{displayedScore.toFixed(1)}</span>
            {!adjusting ? (
              <button type="button" className={styles.adjustLink} onClick={() => setAdjusting(true)}>
                Adjust
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      <div className={styles.actions}>
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!reaction || saving}>
          {saving ? 'Saving…' : 'Save Pour'}
        </Button>
      </div>
    </Modal>
  )
}
