import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { TapChip } from '../../components/ui/TapChip'
import { Field, controlClassName } from '../../components/ui/Field'
import { useUserData } from '../../hooks/useUserData'
import { QUICK_POUR_REACTIONS, type QuickPourReaction } from './reactions'
import { QUICK_POUR_FLAVORS } from './flavors'
import { buildQuickPourInput } from './buildQuickPourInput'
import { PhotoUploadField } from '../photoUpload/PhotoUploadField'
import { PourWizard } from '../pourWizard/PourWizard'
import { fipTier } from '../fip/tiers'
import { useAuth } from '../../hooks/useAuth'
import { TagFriendsField } from '../friends/TagFriendsField'
import { shareStoryWithTaggedFriends } from '../friends/shareStoryOnSave'
import { generateAndSaveTastingSummary } from '../pourWizard/tastingSummaryOnSave'
import { useBottleInstancePicker } from '../pourWizard/useBottleInstancePicker'
import type { Pour } from '../../data/types'
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
// tags -> FIP score -> optional details -> save, in well under a minute. A
// confirmation screen then offers "Tell the Full Story" to reopen the
// just-saved pour in the full wizard for anyone who wants to go deeper — the
// fast path is never blocked on making that choice up front.
export function QuickPour({ bottleId, bottleName, onClose, onSaved }: QuickPourProps) {
  const { user } = useAuth()
  const { userDoc, profile, addPour, updatePourAiSummary } = useUserData()
  const { resolveThenSave, picker: instancePicker } = useBottleInstancePicker(userDoc.bottles.find((b) => b.id === bottleId))
  const [reaction, setReaction] = useState<QuickPourReaction | null>(null)
  const [flavors, setFlavors] = useState<string[]>([])
  const [score, setScore] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [companion, setCompanion] = useState('')
  const [location, setLocation] = useState('')
  const [memoryPhotoUrl, setMemoryPhotoUrl] = useState<string | undefined>(undefined)
  const [memoryPhotoPath, setMemoryPhotoPath] = useState<string | undefined>(undefined)
  const [sharedWithUids, setSharedWithUids] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [savedPour, setSavedPour] = useState<Pour | null>(null)
  const [tellingFullStory, setTellingFullStory] = useState(false)

  function pickReaction(next: QuickPourReaction) {
    setReaction(next)
    setScore(next.score)
  }

  function toggleFlavor(flavor: string) {
    setFlavors((prev) => (prev.includes(flavor) ? prev.filter((f) => f !== flavor) : [...prev, flavor]))
  }

  function handleSave() {
    if (!reaction || score == null || saving) return
    resolveThenSave((bottleInstanceId) => void doSave(bottleInstanceId))
  }

  async function doSave(bottleInstanceId: string | undefined) {
    if (!reaction || score == null) return
    setSaving(true)
    const pour = await addPour(
      buildQuickPourInput({
        bottleId,
        bottleInstanceId,
        date: todayIsoDate(),
        reactionLabel: reaction.label,
        score,
        flavors,
        notes: notes.trim() || undefined,
        companion: companion.trim() || undefined,
        location: location.trim() || undefined,
        memoryPhoto: memoryPhotoUrl ? { url: memoryPhotoUrl, storagePath: memoryPhotoPath, createdAt: Date.now() } : undefined,
        sharedWithUids,
      }),
    )
    setSaving(false)
    onSaved?.()
    if (pour) {
      if (user && pour.sharedWithUids && pour.sharedWithUids.length > 0) {
        const bottle = userDoc.bottles.find((b) => b.id === bottleId)
        void shareStoryWithTaggedFriends(
          { uid: user.uid, username: userDoc.username ?? '', displayName: profile?.displayName || user.displayName || undefined, photoURL: profile?.photoURL },
          pour,
          bottle,
        )
      }
      setSavedPour(pour)
      // Fires only after the save is done — never awaited, so a slow or
      // failed AI call can never delay the confirmation screen.
      void generateAndSaveTastingSummary(pour, updatePourAiSummary)
    } else {
      onClose()
    }
  }

  const displayedScore = score ?? reaction?.score ?? 0

  if (tellingFullStory && savedPour) {
    // Bypasses QuickPour's own Modal entirely — PourWizard renders its own,
    // and the just-saved pour is already real data, so editing it in place
    // (rather than creating a second pour) is what "tell the full story"
    // about *this* pour should mean.
    return (
      <PourWizard bottleId={bottleId} bottleName={bottleName} existingPour={savedPour} onClose={onClose} onSaved={onClose} />
    )
  }

  if (savedPour) {
    const tier = fipTier(savedPour.rating)
    return (
      <Modal title={`Pour Saved — ${bottleName}`} onClose={onClose}>
        <div className={styles.confirmation}>
          <div className={styles.confirmScore} style={{ color: tier.color }}>
            {savedPour.rating.toFixed(1)}
          </div>
          <div className={styles.confirmTier} style={{ color: tier.color }}>
            {tier.label}
          </div>
          <p className={styles.confirmMessage}>Nice pour — saved to {bottleName}&rsquo;s story.</p>
        </div>
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
          <Button onClick={() => setTellingFullStory(true)}>Tell the Full Story</Button>
        </div>
      </Modal>
    )
  }

  return (
    <>
    <Modal title={`Quick Pour — ${bottleName}`} onClose={onClose}>
      <p className={styles.prompt}>How&rsquo;s it drinking tonight?</p>
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
            {QUICK_POUR_FLAVORS.map((flavor) => (
              <TapChip key={flavor} label={flavor} active={flavors.includes(flavor)} onToggle={() => toggleFlavor(flavor)} />
            ))}
          </div>

          <div className={styles.scoreRow}>
            <span className={styles.scoreLabel}>FIP Score</span>
            <input
              type="range"
              min={0}
              max={10}
              step={0.1}
              value={displayedScore}
              onChange={(e) => setScore(Number(e.target.value))}
              aria-label="FIP score"
              className={styles.scoreSlider}
            />
            <span className={styles.scoreValue}>{displayedScore.toFixed(1)}</span>
          </div>

          <details className={styles.moreDetails}>
            <summary className={styles.moreSummary}>Add a note, company, or photo (optional)</summary>
            <div className={styles.moreFields}>
              <Field label="Note" htmlFor="quick-pour-note">
                <textarea
                  id="quick-pour-note"
                  className={controlClassName}
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything worth remembering about this pour…"
                />
              </Field>
              <Field label="Who's with you" htmlFor="quick-pour-companion">
                <input
                  id="quick-pour-companion"
                  type="text"
                  className={controlClassName}
                  value={companion}
                  onChange={(e) => setCompanion(e.target.value)}
                  placeholder="e.g. Dave, or solo"
                />
              </Field>
              <Field label="Where" htmlFor="quick-pour-location">
                <input
                  id="quick-pour-location"
                  type="text"
                  className={controlClassName}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Back porch"
                />
              </Field>
              <PhotoUploadField
                label="Photo"
                folder="pour-photos"
                onUploaded={(url, path) => {
                  setMemoryPhotoUrl(url)
                  setMemoryPhotoPath(path)
                }}
              />
              <TagFriendsField uid={user?.uid} selectedUids={sharedWithUids} onChange={setSharedWithUids} />
            </div>
          </details>
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
    {instancePicker}
    </>
  )
}
