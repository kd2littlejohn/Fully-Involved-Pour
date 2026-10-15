import { useState, type FormEvent } from 'react'
import type { Bottle } from '../../data/types'
import { useUserData } from '../../hooks/useUserData'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field, controlClassName } from '../../components/ui/Field'
import { LEGACY_LIMITS, legacyStoryDraft, legacyStoryPatch, type LegacyStoryDraft } from './legacyBottles'
import styles from './LegacyStory.module.css'

// Edits the Legacy Story on the bottle itself (no separate story record),
// prefilled from what's saved. Tasting notes are not here on purpose: the
// Legacy Story is about what the bottle means, not how it tastes.
export function LegacyStoryEditor({ bottle, onClose, onSaved }: { bottle: Bottle; onClose: () => void; onSaved: () => void }) {
  const { updateBottle } = useUserData()
  const [draft, setDraft] = useState<LegacyStoryDraft>(() => legacyStoryDraft(bottle))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof LegacyStoryDraft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await updateBottle(bottle.id, legacyStoryPatch(draft))
      onSaved()
    } catch {
      setError('Your story couldn’t be saved. Check your connection and try again — nothing you wrote has been lost.')
      setSaving(false)
    }
  }

  return (
    <Modal title="Edit Legacy Story" onClose={onClose}>
      <form className={styles.form} onSubmit={(e) => void handleSubmit(e)} noValidate>
        <p className={styles.bottleName}>{bottle.name}</p>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <Field label="Story title" htmlFor="legacy-title">
          <input
            id="legacy-title"
            className={controlClassName}
            value={draft.title}
            onChange={(e) => set('title')(e.target.value)}
            placeholder="The bottle Dad opened at my wedding"
            maxLength={LEGACY_LIMITS.title}
            autoComplete="off"
          />
        </Field>

        <Field label="Why it matters" htmlFor="legacy-why">
          <input
            id="legacy-why"
            className={controlClassName}
            value={draft.reason}
            onChange={(e) => set('reason')(e.target.value)}
            placeholder="First bourbon I ever loved"
            maxLength={LEGACY_LIMITS.reason}
            autoComplete="off"
          />
        </Field>

        <Field label="Your story" htmlFor="legacy-story">
          <textarea
            id="legacy-story"
            className={`${controlClassName} ${styles.textarea}`}
            value={draft.story}
            onChange={(e) => set('story')(e.target.value)}
            placeholder="Where it came from, who you shared it with, the night it was opened…"
            rows={6}
            maxLength={LEGACY_LIMITS.story}
          />
          <p className={styles.count} aria-live="off">
            {draft.story.length}/{LEGACY_LIMITS.story}
          </p>
        </Field>

        <Field label="Occasion or person" htmlFor="legacy-occasion">
          <input
            id="legacy-occasion"
            className={controlClassName}
            value={draft.occasion}
            onChange={(e) => set('occasion')(e.target.value)}
            placeholder="Gift from Dad"
            maxLength={LEGACY_LIMITS.occasion}
            autoComplete="off"
          />
        </Field>

        <Field label="Meaningful date" htmlFor="legacy-date">
          <input id="legacy-date" type="date" className={controlClassName} value={draft.date} onChange={(e) => set('date')(e.target.value)} />
        </Field>

        <div className={styles.buttons}>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save story'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
