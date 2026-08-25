import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { InfinityBottleHeader } from '../../features/infinityBottle/InfinityBottleHeader'
import { Button } from '../../components/ui/Button'
import { Field, controlClassName } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { useUserData } from '../../hooks/useUserData'
import type { FillLevel } from '../../data/types'
import styles from './AddToBlendPage.module.css'

const FILL_LEVEL_LABEL: Record<FillLevel, string> = {
  full: 'Full',
  'three-quarter': 'About Three-Quarters Full',
  half: 'About Half Full',
  quarter: 'About a Quarter Left',
  empty: 'Empty',
}

const QUICK_ML = [15, 30, 60, 90, 120]
const ML_PER_OZ = 29.5735

export function AddToBlendPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { userDoc, addBlendAddition } = useUserData()
  const [query, setQuery] = useState('')
  const [selectedBottleId, setSelectedBottleId] = useState<string | null>(null)
  const [unit, setUnit] = useState<'ml' | 'oz'>('ml')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const ib = userDoc.infinityBottles.find((b) => b.id === id)
  const batch = ib?.batches[ib.batches.length - 1]

  const availableBottles = userDoc.bottles
    .filter((b) => b.status === 'open')
    .filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase()))

  const selectedBottle = userDoc.bottles.find((b) => b.id === selectedBottleId)
  const amountMl = amount ? (unit === 'ml' ? Number(amount) : Number(amount) * ML_PER_OZ) : 0

  if (!ib || !batch) {
    return (
      <div className={styles.page}>
        <InfinityBottleHeader backTo="/collection/infinity" title="Add to Blend" />
        <div className={styles.body}>
          <EmptyState title="We couldn't find that Infinity Bottle." message="It may have been deleted." />
        </div>
      </div>
    )
  }

  async function handleAdd() {
    if (!selectedBottle || amountMl <= 0 || saving) return
    setSaving(true)
    try {
      await addBlendAddition(ib!.id, batch!.id, {
        sourceBottleId: selectedBottle.id,
        bottleName: selectedBottle.name,
        proof: selectedBottle.proof,
        amountMl: Math.round(amountMl),
        date: new Date().toISOString().slice(0, 10),
        note: note.trim() || undefined,
      })
      navigate(`/collection/infinity/${ib!.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <InfinityBottleHeader backTo={`/collection/infinity/${ib.id}`} title="Add to Blend" />

      <div className={styles.body}>
        <input
          className={controlClassName}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your bottles"
          aria-label="Search your bottles"
        />

        <h2 className={styles.heading}>Select a bottle to add</h2>
        {availableBottles.length === 0 ? (
          <EmptyState title="No open bottles found." message="Only bottles marked Opened in My Bar can be added to a blend." />
        ) : (
          <div className={styles.bottleList}>
            {availableBottles.map((bottle) => (
              <button
                type="button"
                key={bottle.id}
                className={styles.bottleRow}
                onClick={() => setSelectedBottleId(bottle.id)}
                aria-pressed={selectedBottleId === bottle.id}
              >
                <div className={styles.bottleThumb}>
                  {bottle.imageUrl ? <img className={styles.bottleImage} src={bottle.imageUrl} alt="" /> : <BottlePlaceholder compact name={bottle.name} />}
                </div>
                <div className={styles.bottleInfo}>
                  <div className={styles.bottleName}>{bottle.name}</div>
                  <div className={styles.bottleMeta}>
                    {[bottle.proof ? `${bottle.proof} Proof` : null, bottle.bottleSize ? `${bottle.bottleSize}ml bottle` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  {bottle.fillLevel ? <div className={styles.bottleFill}>{FILL_LEVEL_LABEL[bottle.fillLevel]}</div> : null}
                </div>
                <span className={selectedBottleId === bottle.id ? `${styles.radio} ${styles.radioSelected}` : styles.radio} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}

        <h2 className={styles.heading}>Amount to Add</h2>
        <div className={styles.unitToggle} role="group" aria-label="Unit">
          <button type="button" className={unit === 'ml' ? `${styles.unitButton} ${styles.unitButtonActive}` : styles.unitButton} onClick={() => setUnit('ml')}>
            ml
          </button>
          <button type="button" className={unit === 'oz' ? `${styles.unitButton} ${styles.unitButtonActive}` : styles.unitButton} onClick={() => setUnit('oz')}>
            oz
          </button>
        </div>
        <div className={styles.quickAmounts}>
          {QUICK_ML.map((ml) => {
            const displayValue = unit === 'ml' ? ml : Math.round((ml / ML_PER_OZ) * 10) / 10
            return (
              <button
                type="button"
                key={ml}
                className={Number(amount) === displayValue ? `${styles.quickButton} ${styles.quickButtonActive}` : styles.quickButton}
                onClick={() => setAmount(String(displayValue))}
              >
                {displayValue}
                {unit}
              </button>
            )
          })}
        </div>
        <Field label={`Amount to add (${unit})`} htmlFor="add-amount">
          <input
            id="add-amount"
            type="number"
            inputMode="decimal"
            className={controlClassName}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={unit === 'ml' ? '60' : '2'}
          />
        </Field>

        <Field label="Why are you adding this? (optional)" htmlFor="add-note">
          <textarea
            id="add-note"
            className={controlClassName}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What made you pour the last of this one in?"
          />
        </Field>

        <Button onClick={() => void handleAdd()} disabled={!selectedBottle || amountMl <= 0 || saving} className={styles.submit}>
          {saving ? 'Adding…' : `Add ${amount || 0}${unit} to Blend`}
        </Button>
      </div>
    </div>
  )
}
