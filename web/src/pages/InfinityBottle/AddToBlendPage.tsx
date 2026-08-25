import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { InfinityBottleHeader } from '../../features/infinityBottle/InfinityBottleHeader'
import { batchDisplayName, batchVolumeMl, displayBatch, estimatedProof } from '../../features/infinityBottle/selectors'
import { Button } from '../../components/ui/Button'
import { Field, controlClassName } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { useUserData, type NewBlendAdditionInput } from '../../hooks/useUserData'
import type { Bottle, FillLevel } from '../../data/types'
import styles from './AddToBlendPage.module.css'

const FILL_LEVEL_LABEL: Record<FillLevel, string> = {
  full: 'Full',
  'three-quarter': 'About Three-Quarters Full',
  half: 'About Half Full',
  quarter: 'About a Quarter Left',
  empty: 'Empty',
}

const QUICK_ML = [15, 30, 45, 60, 90, 120]
const ML_PER_OZ = 29.5735

const CHECK_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M5 12.5 10 17 19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const CLOSE_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

interface Selection {
  bottleId: string
  // Canonical amount in ml, kept at full precision — the ml/oz input always
  // formats FROM this value and parses back TO it, so toggling units back
  // and forth never compounds rounding (only the final Math.round at save
  // time, matching the single-add page's original behavior, ever truncates).
  amountMl: number
  note: string
}

function formatAmountForUnit(amountMl: number, unit: 'ml' | 'oz'): string {
  if (!amountMl) return ''
  const value = unit === 'ml' ? amountMl : amountMl / ML_PER_OZ
  return String(Math.round(value * 100) / 100)
}

function parseAmountToMl(raw: string, unit: 'ml' | 'oz'): number {
  const value = Number(raw)
  if (!raw.trim() || Number.isNaN(value)) return 0
  return unit === 'ml' ? value : value * ML_PER_OZ
}

export function AddToBlendPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { userDoc, addBlendAdditions } = useUserData()
  const [step, setStep] = useState<'select' | 'amounts'>('select')
  const [query, setQuery] = useState('')
  const [selections, setSelections] = useState<Selection[]>([])
  const [unit, setUnit] = useState<'ml' | 'oz'>('ml')
  const [applyAllAmount, setApplyAllAmount] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const ib = userDoc.infinityBottles.find((b) => b.id === id)
  const batch = ib ? displayBatch(ib) : undefined

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

  if (ib.archived) {
    return (
      <div className={styles.page}>
        <InfinityBottleHeader backTo={`/collection/infinity/${ib.id}`} title="Add to Blend" />
        <div className={styles.body}>
          <EmptyState
            title="This Infinity Bottle is archived."
            message="Unarchive it from Batch Management before adding to the blend."
          />
        </div>
      </div>
    )
  }

  const availableBottles = userDoc.bottles
    .filter((b) => b.status === 'open')
    .filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase()))

  const selectedBottles = selections
    .map((selection) => ({ selection, bottle: userDoc.bottles.find((b) => b.id === selection.bottleId) }))
    .filter((entry): entry is { selection: Selection; bottle: Bottle } => entry.bottle != null)

  function toggleBottle(bottleId: string) {
    setSelections((prev) => (prev.some((s) => s.bottleId === bottleId) ? prev.filter((s) => s.bottleId !== bottleId) : [...prev, { bottleId, amountMl: 0, note: '' }]))
  }

  function updateSelection(bottleId: string, patch: Partial<Omit<Selection, 'bottleId'>>) {
    setSelections((prev) => prev.map((s) => (s.bottleId === bottleId ? { ...s, ...patch } : s)))
  }

  function handleApplyAllAmount() {
    const ml = parseAmountToMl(applyAllAmount, unit)
    if (ml <= 0) return
    setSelections((prev) => prev.map((s) => ({ ...s, amountMl: ml })))
  }

  const pendingTotalMl = Math.round(selectedBottles.reduce((sum, { selection }) => sum + selection.amountMl, 0))
  const currentVolumeMl = batchVolumeMl(batch)
  const newVolumeMl = currentVolumeMl + pendingTotalMl
  const overCapacity = ib.capacityMl != null && newVolumeMl > ib.capacityMl
  const overCapacityByMl = overCapacity ? newVolumeMl - ib.capacityMl! : 0
  const allAmountsValid = selectedBottles.length > 0 && selectedBottles.every(({ selection }) => selection.amountMl > 0)
  const canReview = allAmountsValid && !overCapacity

  const currentProof = estimatedProof(batch)
  const previewBatch = {
    ...batch,
    additions: [
      ...batch.additions,
      ...selectedBottles.map(({ selection, bottle }) => ({
        id: 'preview',
        sourceBottleId: bottle.id,
        bottleName: bottle.name,
        proof: bottle.proof,
        amountMl: Math.round(selection.amountMl),
        date: new Date().toISOString().slice(0, 10),
        note: selection.note.trim() || undefined,
        createdAt: 0,
      })),
    ],
  }
  const newProof = estimatedProof(previewBatch)

  async function handleConfirmSave() {
    if (!canReview || saving) return
    setSaving(true)
    setSaveError(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const inputs: NewBlendAdditionInput[] = selectedBottles.map(({ selection, bottle }) => ({
        sourceBottleId: bottle.id,
        bottleName: bottle.name,
        proof: bottle.proof,
        amountMl: Math.round(selection.amountMl),
        date: today,
        note: selection.note.trim() || undefined,
      }))
      await addBlendAdditions(ib!.id, batch!.id, inputs)
      setSaved(true)
    } catch {
      setSaveError('Could not save these additions. Try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleReviewClose() {
    if (saving) return
    if (saved) {
      navigate(`/collection/infinity/${ib!.id}`)
      return
    }
    setReviewOpen(false)
  }

  const displayName = batchDisplayName(ib, batch)
  const countLabel = `${selectedBottles.length} Bottle${selectedBottles.length === 1 ? '' : 's'}`

  return (
    <div className={styles.page}>
      <InfinityBottleHeader backTo={`/collection/infinity/${ib.id}`} title="Add to Blend" />

      <div className={styles.body}>
        {step === 'select' ? (
          <>
            <input
              className={controlClassName}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your bottles"
              aria-label="Search your bottles"
            />

            <h2 className={styles.heading}>Select Bottles to Add</h2>

            {selections.length > 0 ? (
              <div className={styles.selectionBar}>
                <span className={styles.selectionCount}>{selections.length} Selected</span>
                <div className={styles.selectionBarActions}>
                  <Button variant="ghost" onClick={() => setSelections([])}>
                    Clear
                  </Button>
                  <Button onClick={() => setStep('amounts')}>Continue</Button>
                </div>
              </div>
            ) : null}

            {availableBottles.length === 0 ? (
              <EmptyState title="No open bottles found." message="Only bottles marked Opened in My Bar can be added to a blend." />
            ) : (
              <div className={styles.bottleList}>
                {availableBottles.map((bottle) => {
                  const selected = selections.some((s) => s.bottleId === bottle.id)
                  return (
                    <button
                      type="button"
                      key={bottle.id}
                      className={styles.bottleRow}
                      onClick={() => toggleBottle(bottle.id)}
                      aria-pressed={selected}
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
                      <span className={selected ? `${styles.checkbox} ${styles.checkboxSelected}` : styles.checkbox} aria-hidden="true">
                        {selected ? CHECK_ICON : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <Button variant="ghost" className={styles.backToSelect} onClick={() => setStep('select')}>
              ‹ Back to Bottles
            </Button>

            <h2 className={styles.heading}>Set Amounts</h2>

            <div className={styles.unitToggle} role="group" aria-label="Unit">
              <button type="button" className={unit === 'ml' ? `${styles.unitButton} ${styles.unitButtonActive}` : styles.unitButton} onClick={() => setUnit('ml')}>
                ml
              </button>
              <button type="button" className={unit === 'oz' ? `${styles.unitButton} ${styles.unitButtonActive}` : styles.unitButton} onClick={() => setUnit('oz')}>
                oz
              </button>
            </div>

            {selectedBottles.length > 1 ? (
              <div className={styles.applyAllRow}>
                <input
                  className={controlClassName}
                  type="number"
                  inputMode="decimal"
                  value={applyAllAmount}
                  onChange={(e) => setApplyAllAmount(e.target.value)}
                  placeholder={`Apply same amount to all (${unit})`}
                  aria-label={`Apply same amount to all (${unit})`}
                />
                <Button variant="secondary" onClick={handleApplyAllAmount} disabled={!applyAllAmount}>
                  Apply to All
                </Button>
              </div>
            ) : null}

            <div className={styles.amountList}>
              {selectedBottles.map(({ selection, bottle }) => (
                <div className={styles.amountCard} key={bottle.id}>
                  <div className={styles.amountCardHeader}>
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
                    <button type="button" className={styles.removeButton} onClick={() => toggleBottle(bottle.id)} aria-label={`Remove ${bottle.name}`}>
                      {CLOSE_ICON}
                    </button>
                  </div>

                  <div className={styles.quickAmounts}>
                    {QUICK_ML.map((ml) => (
                      <button
                        type="button"
                        key={ml}
                        className={selection.amountMl === ml ? `${styles.quickButton} ${styles.quickButtonActive}` : styles.quickButton}
                        onClick={() => updateSelection(bottle.id, { amountMl: ml })}
                      >
                        {unit === 'ml' ? ml : Math.round((ml / ML_PER_OZ) * 10) / 10}
                        {unit}
                      </button>
                    ))}
                  </div>

                  <Field label={`Amount (${unit})`} htmlFor={`amount-${bottle.id}`}>
                    <input
                      id={`amount-${bottle.id}`}
                      type="number"
                      inputMode="decimal"
                      className={controlClassName}
                      value={formatAmountForUnit(selection.amountMl, unit)}
                      onChange={(e) => updateSelection(bottle.id, { amountMl: parseAmountToMl(e.target.value, unit) })}
                      placeholder={unit === 'ml' ? '60' : '2'}
                    />
                  </Field>

                  <Field label="Why are you adding this? (optional)" htmlFor={`note-${bottle.id}`}>
                    <textarea
                      id={`note-${bottle.id}`}
                      className={controlClassName}
                      rows={2}
                      value={selection.note}
                      onChange={(e) => updateSelection(bottle.id, { note: e.target.value })}
                      placeholder="What made you pour the last of this one in?"
                    />
                  </Field>
                </div>
              ))}
            </div>

            <div className={styles.totalsCard}>
              <div className={styles.totalsRow}>
                <span>Current Volume</span>
                <span>{currentVolumeMl}ml</span>
              </div>
              <div className={styles.totalsRow}>
                <span>Adding</span>
                <span>{pendingTotalMl}ml</span>
              </div>
              <div className={styles.totalsRow}>
                <span>New Volume</span>
                <span>
                  {newVolumeMl}
                  {ib.capacityMl ? ` / ${ib.capacityMl}ml` : 'ml'}
                </span>
              </div>
              {overCapacity ? (
                <p className={styles.error} role="alert">
                  This would exceed your {ib.capacityMl}ml capacity by {overCapacityByMl}ml.
                </p>
              ) : null}
            </div>

            <Button
              onClick={() => {
                setSaved(false)
                setReviewOpen(true)
              }}
              disabled={!canReview}
              className={styles.submit}
            >
              Add {countLabel} to Blend
            </Button>
          </>
        )}
      </div>

      {reviewOpen ? (
        <Modal title={saved ? 'Added to Blend' : `Add to ${displayName}?`} onClose={handleReviewClose}>
          {saved ? (
            <>
              <p className={styles.confirmText}>
                {countLabel} added to {displayName}.
              </p>
              <div className={styles.modalActions}>
                <Button onClick={() => navigate(`/collection/infinity/${ib.id}`)}>Done</Button>
              </div>
            </>
          ) : (
            <>
              <div className={styles.reviewList}>
                {selectedBottles.map(({ selection, bottle }) => (
                  <div className={styles.reviewRow} key={bottle.id}>
                    <span className={styles.reviewName}>{bottle.name}</span>
                    <span className={styles.reviewAmount}>{Math.round(selection.amountMl)}ml</span>
                  </div>
                ))}
              </div>
              <div className={styles.reviewTotals}>
                <div className={styles.totalsRow}>
                  <span>Total</span>
                  <span>{pendingTotalMl}ml</span>
                </div>
                <div className={styles.totalsRow}>
                  <span>Estimated new volume</span>
                  <span>{newVolumeMl}ml</span>
                </div>
                {currentProof != null && newProof != null ? (
                  <div className={styles.totalsRow}>
                    <span>Estimated proof</span>
                    <span>
                      {currentProof.toFixed(1)} → {newProof.toFixed(1)}
                    </span>
                  </div>
                ) : (
                  <div className={styles.totalsRow}>
                    <span>Estimated proof</span>
                    <span>Unavailable</span>
                  </div>
                )}
              </div>
              {saveError ? (
                <p className={styles.error} role="alert">
                  {saveError}
                </p>
              ) : null}
              <div className={styles.modalActions}>
                <Button variant="ghost" onClick={() => setReviewOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={() => void handleConfirmSave()} disabled={saving}>
                  {saving ? 'Adding…' : `Add ${countLabel} to Blend`}
                </Button>
              </div>
            </>
          )}
        </Modal>
      ) : null}
    </div>
  )
}
