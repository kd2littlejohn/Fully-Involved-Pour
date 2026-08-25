import { useState } from 'react'
import { Field, controlClassName } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import { TapChip } from '../../components/ui/TapChip'
import { PhotoUploadField } from '../photoUpload/PhotoUploadField'
import { NOSE_AROMAS, PALATE_FLAVORS } from '../fip/scoring'
import { fipTier } from '../fip/tiers'
import type { NewTastingInput } from '../../hooks/useUserData'
import styles from './TastingForm.module.css'

export interface TastingFormValue {
  date: string
  score: number
  noseAromas: string[]
  noseNotes: string
  palateFlavors: string[]
  palateNotes: string
  finishNotes: string
  overallNotes: string
  companion: string
  photoUrl?: string
  photoStoragePath?: string
}

export function blankTastingValue(): TastingFormValue {
  return {
    date: new Date().toISOString().slice(0, 10),
    score: 5,
    noseAromas: [],
    noseNotes: '',
    palateFlavors: [],
    palateNotes: '',
    finishNotes: '',
    overallNotes: '',
    companion: '',
  }
}

export function tastingValueToInput(value: TastingFormValue): NewTastingInput {
  return {
    date: value.date,
    score: value.score,
    noseAromas: value.noseAromas,
    noseNotes: value.noseNotes.trim() || undefined,
    palateFlavors: value.palateFlavors,
    palateNotes: value.palateNotes.trim() || undefined,
    finishNotes: value.finishNotes.trim() || undefined,
    overallNotes: value.overallNotes.trim() || undefined,
    companion: value.companion.trim() || undefined,
    photoUrl: value.photoUrl,
    photoStoragePath: value.photoStoragePath,
  }
}

interface TastingFormProps {
  value: TastingFormValue
  onChange: (patch: Partial<TastingFormValue>) => void
  onSubmit: () => void
  submitLabel: string
  submitting: boolean
}

// Reuses the real FIP scoring/tier primitives and the same Nose/Palate chip
// pickers Pour uses (NOSE_AROMAS/PALATE_FLAVORS + TapChip) — but a single
// direct 0-10 score, matching Quick Pour's slider, not the full 5-component
// Pour Wizard breakdown (this is one page, not a multi-step wizard).
export function TastingForm({ value, onChange, onSubmit, submitLabel, submitting }: TastingFormProps) {
  const [uid] = useState('infinity-tasting')
  const tier = fipTier(value.score)

  function toggleAroma(aroma: string) {
    onChange({ noseAromas: value.noseAromas.includes(aroma) ? value.noseAromas.filter((a) => a !== aroma) : [...value.noseAromas, aroma] })
  }

  function toggleFlavor(flavor: string) {
    onChange({
      palateFlavors: value.palateFlavors.includes(flavor) ? value.palateFlavors.filter((f) => f !== flavor) : [...value.palateFlavors, flavor],
    })
  }

  return (
    <div className={styles.form}>
      <Field label="Date" htmlFor={`${uid}-date`}>
        <input
          id={`${uid}-date`}
          type="date"
          className={controlClassName}
          value={value.date}
          onChange={(e) => onChange({ date: e.target.value })}
        />
      </Field>

      <div className={styles.scoreRow}>
        <span className={styles.scoreLabel}>Score (0-10)</span>
        <input
          type="range"
          min={0}
          max={10}
          step={0.1}
          value={value.score}
          onChange={(e) => onChange({ score: Number(e.target.value) })}
          aria-label="Score"
          className={styles.scoreSlider}
        />
        <span className={styles.scoreValue} style={{ color: tier.color }}>
          {value.score.toFixed(1)}
        </span>
      </div>
      <div className={styles.tierLabel} style={{ color: tier.color }}>
        {tier.label}
      </div>

      <Field label="Nose" htmlFor={`${uid}-nose-notes`}>
        <div className={styles.chipRow}>
          {NOSE_AROMAS.map((aroma) => (
            <TapChip key={aroma} label={aroma} active={value.noseAromas.includes(aroma)} onToggle={() => toggleAroma(aroma)} />
          ))}
        </div>
        <textarea
          id={`${uid}-nose-notes`}
          className={controlClassName}
          rows={2}
          value={value.noseNotes}
          onChange={(e) => onChange({ noseNotes: e.target.value })}
          placeholder="Caramel, vanilla, oak, toast…"
        />
      </Field>

      <Field label="Palate" htmlFor={`${uid}-palate-notes`}>
        <div className={styles.chipRow}>
          {PALATE_FLAVORS.map((flavor) => (
            <TapChip key={flavor} label={flavor} active={value.palateFlavors.includes(flavor)} onToggle={() => toggleFlavor(flavor)} />
          ))}
        </div>
        <textarea
          id={`${uid}-palate-notes`}
          className={controlClassName}
          rows={2}
          value={value.palateNotes}
          onChange={(e) => onChange({ palateNotes: e.target.value })}
          placeholder="Caramel, baking spice, cherry, oaky spice…"
        />
      </Field>

      <Field label="Finish" htmlFor={`${uid}-finish-notes`}>
        <textarea
          id={`${uid}-finish-notes`}
          className={controlClassName}
          rows={2}
          value={value.finishNotes}
          onChange={(e) => onChange({ finishNotes: e.target.value })}
          placeholder="Medium long, warm, oak, butterscotch…"
        />
      </Field>

      <Field label="Overall Notes" htmlFor={`${uid}-overall-notes`}>
        <textarea
          id={`${uid}-overall-notes`}
          className={controlClassName}
          rows={3}
          value={value.overallNotes}
          onChange={(e) => onChange({ overallNotes: e.target.value })}
          placeholder="How's this batch coming along?"
        />
      </Field>

      <PhotoUploadField
        label="Photo (optional)"
        folder="infinity-bottle-photos"
        currentUrl={value.photoUrl}
        onUploaded={(url, path) => onChange({ photoUrl: url, photoStoragePath: path })}
      />

      <Field label="Companion (optional)" htmlFor={`${uid}-companion`}>
        <input
          id={`${uid}-companion`}
          className={controlClassName}
          value={value.companion}
          onChange={(e) => onChange({ companion: e.target.value })}
          placeholder="Cigar, Friends, Good Conversation"
        />
      </Field>

      <Button onClick={onSubmit} disabled={submitting} className={styles.submit}>
        {submitting ? 'Saving…' : submitLabel}
      </Button>
    </div>
  )
}
