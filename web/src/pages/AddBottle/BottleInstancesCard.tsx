import { useState } from 'react'
import { Field, controlClassName } from '../../components/ui/Field'
import { Badge } from '../../components/ui/Badge'
import styles from './FieldsCard.module.css'

export interface InstanceDraft {
  id: string
  label: string
  purchaseDate: string
  price: string
  storeLocation: string
}

export function blankInstanceDraft(id: string): InstanceDraft {
  return { id, label: '', purchaseDate: '', price: '', storeLocation: '' }
}

interface Instance1Preview {
  statusLabel: string
  purchaseDate?: string
  price?: string
  storeLocation?: string
}

interface BottleInstancesCardProps {
  instance1: Instance1Preview
  drafts: InstanceDraft[]
  onDraftsChange: (drafts: InstanceDraft[]) => void
}

// The "Your Bottles" section — only ever rendered by AddBottlePage once
// Quantity is 2 or more. Bottle 1 is a read-only preview of what's already
// been typed into Essential/Ownership above (never re-entered here);
// Bottles 2+ are optional per-instance drafts that become real
// BottleInstance records on save, always starting Sealed (see the Status
// Rules the parent page implements — additional instances are never
// auto-opened).
export function BottleInstancesCard({ instance1, drafts, onDraftsChange }: BottleInstancesCardProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  function updateDraft(index: number, patch: Partial<InstanceDraft>) {
    onDraftsChange(drafts.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  function applySameDetailsToAll() {
    onDraftsChange(
      drafts.map((d) => ({
        ...d,
        purchaseDate: instance1.purchaseDate ?? d.purchaseDate,
        price: instance1.price ?? d.price,
        storeLocation: instance1.storeLocation ?? d.storeLocation,
      })),
    )
  }

  const instance1Meta = [instance1.purchaseDate, instance1.price ? `$${instance1.price}` : null, instance1.storeLocation]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Your Bottles</h2>

      <div className={styles.instanceRow}>
        <span className={styles.instanceTitle}>Bottle 1</span>
        <Badge tone={instance1.statusLabel === 'Opened' ? 'amber' : 'default'}>{instance1.statusLabel}</Badge>
      </div>
      <p className={styles.instanceMeta}>{instance1Meta || 'Uses the purchase details entered above.'}</p>

      {drafts.length > 0 ? (
        <button type="button" className={styles.askAiLink} onClick={applySameDetailsToAll}>
          Same purchase details for all bottles
        </button>
      ) : null}

      {drafts.map((draft, index) => {
        const open = openIndex === index
        const meta = [draft.purchaseDate, draft.price ? `$${draft.price}` : null, draft.storeLocation].filter(Boolean).join(' · ')
        return (
          <div key={draft.id} className={styles.instanceCard}>
            <button
              type="button"
              className={styles.toggleButton}
              onClick={() => setOpenIndex(open ? null : index)}
              aria-expanded={open}
            >
              <span className={styles.instanceTitle}>
                Bottle {index + 2}
                {draft.label.trim() ? ` — ${draft.label.trim()}` : ''}
              </span>
              <span className={styles.instanceRowRight}>
                <Badge>Sealed</Badge>
                <span className={open ? `${styles.toggleIcon} ${styles.toggleIconOpen}` : styles.toggleIcon} aria-hidden="true">
                  ▾
                </span>
              </span>
            </button>
            {!open && meta ? <p className={styles.instanceMeta}>{meta}</p> : null}

            {open ? (
              <div className={styles.body}>
                <Field label="Nickname (optional)" htmlFor={`instance-${draft.id}-label`}>
                  <input
                    id={`instance-${draft.id}-label`}
                    className={controlClassName}
                    value={draft.label}
                    onChange={(e) => updateDraft(index, { label: e.target.value })}
                    placeholder="Total Wine pick, Batch 24…"
                  />
                </Field>
                <div className={styles.row}>
                  <Field label="Price paid (optional)" htmlFor={`instance-${draft.id}-price`}>
                    <input
                      id={`instance-${draft.id}-price`}
                      className={controlClassName}
                      type="number"
                      inputMode="decimal"
                      value={draft.price}
                      onChange={(e) => updateDraft(index, { price: e.target.value })}
                      placeholder="45.99"
                    />
                  </Field>
                  <Field label="Store (optional)" htmlFor={`instance-${draft.id}-store`}>
                    <input
                      id={`instance-${draft.id}-store`}
                      className={controlClassName}
                      value={draft.storeLocation}
                      onChange={(e) => updateDraft(index, { storeLocation: e.target.value })}
                      placeholder="ABC Liquor"
                    />
                  </Field>
                </div>
                <Field label="Purchase date (optional)" htmlFor={`instance-${draft.id}-date`}>
                  <input
                    id={`instance-${draft.id}-date`}
                    className={controlClassName}
                    type="date"
                    value={draft.purchaseDate}
                    onChange={(e) => updateDraft(index, { purchaseDate: e.target.value })}
                  />
                </Field>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
