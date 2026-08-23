import { useState } from 'react'
import { Field, controlClassName } from '../../components/ui/Field'
import type { BottleStatus, FillLevel } from '../../data/types'
import { generateTastingProfile } from '../../data/repositories/ai'
import styles from './FieldsCard.module.css'

export interface OwnershipFieldsValues {
  status: BottleStatus
  price: string
  msrp: string
  storeLocation: string
  shelf: string
  quantity: string
  fillLevel: FillLevel | ''
  priority: string
  purchaseDate: string
  openedDate: string
  expectedDate: string
  finishedDate: string
  notes: string
  legacyShelf: boolean
  legacyShelfReason: string
}

const FILL_LEVEL_OPTIONS: { value: FillLevel; label: string }[] = [
  { value: 'full', label: 'Full' },
  { value: 'three-quarter', label: 'Three Quarter' },
  { value: 'half', label: 'Half' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'empty', label: 'Empty' },
]

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export interface BottleContext {
  name: string
  distillery: string
  type: string
  proof: string
}

interface OwnershipFieldsCardProps {
  values: OwnershipFieldsValues
  onChange: (patch: Partial<OwnershipFieldsValues>) => void
  bottleContext: BottleContext
}

const STATUS_OPTIONS: { value: BottleStatus; label: string }[] = [
  { value: 'sealed', label: 'Sealed' },
  { value: 'open', label: 'Opened' },
  { value: 'finished', label: 'Finished' },
  { value: 'wishlist', label: 'Wish List' },
  { value: 'incoming', label: 'Incoming' },
]

export function OwnershipFieldsCard({ values, onChange, bottleContext }: OwnershipFieldsCardProps) {
  const [open, setOpen] = useState(false)
  const [generatingNotes, setGeneratingNotes] = useState(false)
  const [notesStatus, setNotesStatus] = useState<string | null>(null)

  async function handleGenerateNotes() {
    const name = bottleContext.name.trim()
    if (name.length < 3 || generatingNotes) return
    setGeneratingNotes(true)
    setNotesStatus('✨ Asking the sommelier…')
    try {
      const profile = await generateTastingProfile({
        bottleName: name,
        distillery: bottleContext.distillery.trim() || undefined,
        type: bottleContext.type.trim() || undefined,
        proof: bottleContext.proof ? Number(bottleContext.proof) : undefined,
      })
      const generated = [profile.nose, profile.palate, profile.finish].filter(Boolean).join(' ')
      onChange({ notes: values.notes.trim() ? values.notes : generated })
      setNotesStatus('✨ AI tasting note added below.')
    } catch {
      setNotesStatus("The sommelier couldn't generate a note just now. Try again in a moment.")
    } finally {
      setGeneratingNotes(false)
    }
  }

  return (
    <div className={styles.card}>
      <button type="button" className={styles.toggleButton} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Your Bottle
        <span className={open ? `${styles.toggleIcon} ${styles.toggleIconOpen}` : styles.toggleIcon} aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div className={styles.body}>
          <Field label="Status" htmlFor="ab-status">
            <select
              id="ab-status"
              className={controlClassName}
              value={values.status}
              onChange={(e) => {
                const status = e.target.value as BottleStatus
                // Default to today the moment a bottle becomes Finished, but
                // never overwrite a date already entered (e.g. flipping the
                // status back and forth) or one carried over from a legacy
                // finished bottle that never had one — that stays blank
                // until the user deliberately picks a real date.
                const finishedDate = status === 'finished' && !values.finishedDate ? todayIsoDate() : values.finishedDate
                // Same idea for fill level: a freshly opened bottle starts
                // full and a finished one is empty, unless the user already
                // recorded something more specific.
                let fillLevel = values.fillLevel
                if (!fillLevel) {
                  if (status === 'open') fillLevel = 'full'
                  else if (status === 'finished') fillLevel = 'empty'
                }
                onChange({ status, finishedDate, fillLevel })
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          {/* Priority only means anything for the Wishlist tab it sorts —
              hidden the rest of the time instead of shown-but-meaningless. */}
          {values.status === 'wishlist' ? (
            <Field label="Wishlist priority (optional, lower = higher priority)" htmlFor="ab-priority">
              <input
                id="ab-priority"
                className={controlClassName}
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={values.priority}
                onChange={(e) => onChange({ priority: e.target.value })}
                placeholder="1"
              />
            </Field>
          ) : null}

          <div className={styles.row}>
            <Field label="Price paid (optional)" htmlFor="ab-price">
              <input
                id="ab-price"
                className={controlClassName}
                type="number"
                inputMode="decimal"
                value={values.price}
                onChange={(e) => onChange({ price: e.target.value })}
                placeholder="45.99"
              />
            </Field>

            <Field label="MSRP (optional)" htmlFor="ab-msrp">
              <input
                id="ab-msrp"
                className={controlClassName}
                type="number"
                inputMode="decimal"
                value={values.msrp}
                onChange={(e) => onChange({ msrp: e.target.value })}
                placeholder="40.00"
              />
            </Field>
          </div>

          <div className={styles.row}>
            <Field label="Quantity (optional)" htmlFor="ab-quantity">
              <input
                id="ab-quantity"
                className={controlClassName}
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={values.quantity}
                onChange={(e) => onChange({ quantity: e.target.value })}
                placeholder="1"
              />
            </Field>

            <Field label="Store (optional)" htmlFor="ab-store">
              <input
                id="ab-store"
                className={controlClassName}
                value={values.storeLocation}
                onChange={(e) => onChange({ storeLocation: e.target.value })}
                placeholder="ABC Liquor"
              />
            </Field>
          </div>

          <div className={styles.row}>
            <Field label="Shelf (optional)" htmlFor="ab-shelf">
              <input
                id="ab-shelf"
                className={controlClassName}
                value={values.shelf}
                onChange={(e) => onChange({ shelf: e.target.value })}
                placeholder="Top Shelf"
              />
            </Field>

            <Field label="Fill level (optional)" htmlFor="ab-fill-level">
              <select
                id="ab-fill-level"
                className={controlClassName}
                value={values.fillLevel}
                onChange={(e) => onChange({ fillLevel: e.target.value as FillLevel | '' })}
              >
                <option value="">—</option>
                {FILL_LEVEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* All three shown together, regardless of current status — a
              bottle's history (when it was opened, expected, finished) is
              worth correcting even after the status has since moved on. */}
          <div className={styles.row}>
            <Field label="Purchase date (optional)" htmlFor="ab-purchase-date">
              <input
                id="ab-purchase-date"
                className={controlClassName}
                type="date"
                value={values.purchaseDate}
                onChange={(e) => onChange({ purchaseDate: e.target.value })}
              />
            </Field>

            <Field label="Opened date (optional)" htmlFor="ab-opened-date">
              <input
                id="ab-opened-date"
                className={controlClassName}
                type="date"
                value={values.openedDate}
                onChange={(e) => onChange({ openedDate: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Finished date (optional)" htmlFor="ab-finished-date">
            <input
              id="ab-finished-date"
              className={controlClassName}
              type="date"
              value={values.finishedDate}
              onChange={(e) => onChange({ finishedDate: e.target.value })}
            />
          </Field>

          <Field label="Expected arrival (optional)" htmlFor="ab-expected-date">
            <input
              id="ab-expected-date"
              className={controlClassName}
              type="date"
              value={values.expectedDate}
              onChange={(e) => onChange({ expectedDate: e.target.value })}
            />
          </Field>

          <Field label="Bottle notes (optional)" htmlFor="ab-notes">
            <textarea
              id="ab-notes"
              className={controlClassName}
              rows={3}
              value={values.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              placeholder="Anything worth remembering about this bottle."
            />
          </Field>

          <div className={styles.checkboxRow}>
            <input
              id="ab-legacy-shelf"
              type="checkbox"
              checked={values.legacyShelf}
              onChange={(e) => onChange({ legacyShelf: e.target.checked, legacyShelfReason: e.target.checked ? values.legacyShelfReason : '' })}
            />
            <label htmlFor="ab-legacy-shelf">This is a Legacy Shelf bottle</label>
          </div>

          {values.legacyShelf ? (
            <Field label="Why it's on your Legacy Shelf (optional)" htmlFor="ab-legacy-shelf-reason">
              <input
                id="ab-legacy-shelf-reason"
                className={controlClassName}
                value={values.legacyShelfReason}
                onChange={(e) => onChange({ legacyShelfReason: e.target.value })}
                placeholder="First bourbon I ever loved"
              />
            </Field>
          ) : null}

          <button
            type="button"
            className={styles.askAiLink}
            onClick={handleGenerateNotes}
            disabled={generatingNotes || bottleContext.name.trim().length < 3}
          >
            {generatingNotes ? 'Asking AI…' : '✨ AI Tasting Note'}
          </button>
          {notesStatus ? <p className={styles.aiStatus}>{notesStatus}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
