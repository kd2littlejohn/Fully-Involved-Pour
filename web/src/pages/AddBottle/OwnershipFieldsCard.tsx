import { useState } from 'react'
import { Field, controlClassName } from '../../components/ui/Field'
import type { BottleStatus } from '../../data/types'
import styles from './FieldsCard.module.css'

export interface OwnershipFieldsValues {
  status: BottleStatus
  price: string
  storeLocation: string
  openedDate: string
  notes: string
}

interface OwnershipFieldsCardProps {
  values: OwnershipFieldsValues
  onChange: (patch: Partial<OwnershipFieldsValues>) => void
}

const STATUS_OPTIONS: { value: BottleStatus; label: string }[] = [
  { value: 'sealed', label: 'Sealed' },
  { value: 'open', label: 'Opened' },
  { value: 'finished', label: 'Finished' },
  { value: 'wishlist', label: 'Wish List' },
]

export function OwnershipFieldsCard({ values, onChange }: OwnershipFieldsCardProps) {
  const [open, setOpen] = useState(false)

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
              onChange={(e) => onChange({ status: e.target.value as BottleStatus })}
            >
              {STATUS_OPTIONS.map((option) => (
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
                onChange={(e) => onChange({ price: e.target.value })}
                placeholder="45.99"
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

          {values.status === 'open' ? (
            <Field label="Opened date" htmlFor="ab-opened-date">
              <input
                id="ab-opened-date"
                className={controlClassName}
                type="date"
                value={values.openedDate}
                onChange={(e) => onChange({ openedDate: e.target.value })}
              />
            </Field>
          ) : null}

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
        </div>
      ) : null}
    </div>
  )
}
