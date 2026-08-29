import { useState } from 'react'
import { Field, controlClassName } from '../../components/ui/Field'
import type { BottleStatus, FillLevel } from '../../data/types'
import { generateTastingProfile } from '../../data/repositories/ai'
import styles from './FieldsCard.module.css'

export interface OwnershipFieldsValues {
  status: BottleStatus
  fillLevel: FillLevel | ''
  price: string
  storeLocation: string
  quantity: string
  purchaseDate: string
  openedDate: string
  expectedDate: string
  finishedDate: string
  notes: string
}

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
  // True once this bottle already has more than one physical instance —
  // those instance records are the authoritative source for status/price/
  // store/dates/fill level from here on, so this card stops offering to
  // edit them directly (that would silently clobber whichever instance's
  // history a top-level save happened to overwrite). Quantity becomes a
  // plain readout; edit individual bottles from Bottle Details instead.
  multiInstance?: boolean
}

const STATUS_OPTIONS: { value: BottleStatus; label: string }[] = [
  { value: 'sealed', label: 'Sealed' },
  { value: 'open', label: 'Opened' },
  { value: 'finished', label: 'Finished' },
  { value: 'wishlist', label: 'Wish List' },
  { value: 'incoming', label: 'Incoming' },
]

const FILL_LEVEL_OPTIONS: { value: FillLevel; label: string }[] = [
  { value: 'full', label: 'Full' },
  { value: 'three-quarter', label: 'Three Quarter' },
  { value: 'half', label: 'Half' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'empty', label: 'Empty' },
]

export function OwnershipFieldsCard({ values, onChange, bottleContext, multiInstance = false }: OwnershipFieldsCardProps) {
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
          {multiInstance ? (
            <p className={styles.conditionalNote}>
              This bottle has multiple physical instances — status, price, store, and dates are set per bottle from Bottle
              Details, not here.
            </p>
          ) : null}

          <Field label="Status" htmlFor="ab-status">
            <select
              id="ab-status"
              className={controlClassName}
              value={values.status}
              disabled={multiInstance}
              onChange={(e) => {
                const status = e.target.value as BottleStatus
                // Default to today the moment a bottle becomes Finished, but
                // never overwrite a date already entered (e.g. flipping the
                // status back and forth) or one carried over from a legacy
                // finished bottle that never had one — that stays blank
                // until the user deliberately picks a real date.
                onChange({ status, finishedDate: status === 'finished' && !values.finishedDate ? todayIsoDate() : values.finishedDate })
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Fill level (optional)" htmlFor="ab-fill-level">
            <select
              id="ab-fill-level"
              className={controlClassName}
              value={values.fillLevel}
              disabled={multiInstance}
              onChange={(e) => onChange({ fillLevel: e.target.value as FillLevel | '' })}
            >
              <option value="">Not set</option>
              {FILL_LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <div className={styles.row}>
            <Field label="Price paid (optional)" htmlFor="ab-price">
              <input
                id="ab-price"
                className={controlClassName}
                type="number"
                inputMode="decimal"
                value={values.price}
                disabled={multiInstance}
                onChange={(e) => onChange({ price: e.target.value })}
                placeholder="45.99"
              />
            </Field>

            <Field label="Quantity (optional)" htmlFor="ab-quantity">
              {multiInstance ? (
                <input id="ab-quantity" className={controlClassName} value={values.quantity} disabled readOnly />
              ) : (
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
              )}
            </Field>
          </div>

          <div className={styles.row}>
            <Field label="Purchase date (optional)" htmlFor="ab-purchase-date">
              <input
                id="ab-purchase-date"
                className={controlClassName}
                type="date"
                value={values.purchaseDate}
                disabled={multiInstance}
                onChange={(e) => onChange({ purchaseDate: e.target.value })}
              />
            </Field>

            <Field label="Store (optional)" htmlFor="ab-store">
              <input
                id="ab-store"
                className={controlClassName}
                value={values.storeLocation}
                disabled={multiInstance}
                onChange={(e) => onChange({ storeLocation: e.target.value })}
                placeholder="ABC Liquor"
              />
            </Field>
          </div>

          {/* All three shown together, regardless of current status — a
              bottle's history (when it was opened, expected, finished) is
              worth correcting even after the status has since moved on. */}
          <div className={styles.row}>
            <Field label="Opened date (optional)" htmlFor="ab-opened-date">
              <input
                id="ab-opened-date"
                className={controlClassName}
                type="date"
                value={values.openedDate}
                disabled={multiInstance}
                onChange={(e) => onChange({ openedDate: e.target.value })}
              />
            </Field>

            <Field label="Finished date (optional)" htmlFor="ab-finished-date">
              <input
                id="ab-finished-date"
                className={controlClassName}
                type="date"
                value={values.finishedDate}
                disabled={multiInstance}
                onChange={(e) => onChange({ finishedDate: e.target.value })}
              />
            </Field>
          </div>

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
