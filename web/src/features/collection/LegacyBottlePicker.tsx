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
// created: the bottle stays exactly where it is in the inventory. With
// `replacing`, it instead moves Legacy status from that bottle to the
// chosen one; the replaced bottle keeps its story and everything else.
export function LegacyBottlePicker({
  bottles,
  replacing,
  onClose,
  onSaved,
}: {
  bottles: Bottle[]
  replacing?: Bottle
  onClose: () => void
  onSaved?: (bottle: Bottle) => void
}) {
  const { updateBottle, changeLegacyBottle } = useUserData()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const q = query.trim().toLowerCase()
  const candidates = legacyCandidates(bottles).filter((b) => b.name.toLowerCase().includes(q) || Boolean(b.distillery?.toLowerCase().includes(q)))
  const selected = bottles.find((b) => b.id === selectedId)

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setError(null)
    const trimmed = reason.trim()
    // Keep any story already saved on the bottle unless a new one is given.
    const patch = trimmed ? { legacyShelfReason: trimmed } : {}
    try {
      if (replacing) await changeLegacyBottle(replacing.id, selected.id, patch)
      else await updateBottle(selected.id, { legacyShelf: true, ...patch })
    } catch {
      setError('That change couldn’t be saved. Check your connection and try again.')
      setSaving(false)
      return
    }
    setSaving(false)
    onSaved?.(selected)
    onClose()
  }

  return (
    <Modal title={replacing ? 'Change Legacy Bottle' : 'Choose a Legacy Bottle'} onClose={onClose}>
      <p className={styles.intro}>
        {replacing
          ? `Pick another bottle from My Bar. ${replacing.name} stays in your bar with its story saved.`
          : 'The bottle that means the most: a gift, a milestone, a first. It stays in your bar as it is.'}
      </p>
      {selected ? (
        <div className={styles.form}>
          <p className={styles.selected}>{selected.name}</p>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
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
            <p className={styles.empty}>{query.trim() ? 'No bottles match that search.' : 'No bottles to choose from.'}</p>
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
