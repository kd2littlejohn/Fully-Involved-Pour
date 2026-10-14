import { useState } from 'react'
import type { Bottle } from '../../data/types'
import { useUserData } from '../../hooks/useUserData'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { controlClassName } from '../../components/ui/Field'
import { legacyCandidates } from './legacyBottles'
import styles from './LegacyBottlePicker.module.css'

// Marks one existing bottle as a Legacy Bottle (legacyShelf, plus an
// optional "why it matters" in legacyShelfReason). Nothing is copied or
// created: the bottle stays exactly where it is in the inventory.
export function LegacyBottlePicker({ bottles, onClose }: { bottles: Bottle[]; onClose: () => void }) {
  const { updateBottle } = useUserData()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const candidates = legacyCandidates(bottles).filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase()))
  const selected = bottles.find((b) => b.id === selectedId)

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    const trimmed = reason.trim()
    // Keep any story already saved on the bottle unless a new one is given.
    await updateBottle(selected.id, trimmed ? { legacyShelf: true, legacyShelfReason: trimmed } : { legacyShelf: true })
    setSaving(false)
    onClose()
  }

  return (
    <Modal title="Choose a Legacy Bottle" onClose={onClose}>
      <p className={styles.intro}>The bottle that means the most: a gift, a milestone, a first. It stays in your bar as it is.</p>
      {selected ? (
        <div className={styles.form}>
          <p className={styles.selected}>{selected.name}</p>
          <label className={styles.label} htmlFor="legacy-reason">
            Why it matters (optional)
          </label>
          <textarea
            id="legacy-reason"
            className={`${controlClassName} ${styles.reason}`}
            value={reason}
            placeholder={selected.legacyShelfReason || 'First bourbon I ever loved…'}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={200}
          />
          <div className={styles.buttons}>
            <Button variant="ghost" onClick={() => setSelectedId(null)} disabled={saving}>
              Back
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : 'Make it my Legacy Bottle'}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <input
            type="search"
            className={controlClassName}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your bottles…"
            aria-label="Search your bottles"
          />
          {candidates.length === 0 ? (
            <p className={styles.empty}>No bottles to choose from.</p>
          ) : (
            <ul className={styles.list}>
              {candidates.map((bottle) => (
                <li key={bottle.id}>
                  <button type="button" className={styles.option} onClick={() => setSelectedId(bottle.id)}>
                    <span className={styles.optionName}>{bottle.name}</span>
                    {bottle.distillery ? <span className={styles.optionMeta}>{bottle.distillery}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Modal>
  )
}
