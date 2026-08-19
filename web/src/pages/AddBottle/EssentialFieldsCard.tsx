import { useState } from 'react'
import { Field, controlClassName } from '../../components/ui/Field'
import { Combobox } from '../../components/ui/Combobox'
import { lookupBottleInfo } from '../../data/repositories/ai'
import { distilleryToOption, searchDistilleries } from '../../data/distillery/search'
import styles from './FieldsCard.module.css'

export interface EssentialFieldsValues {
  name: string
  distillery: string
  type: string
  proof: string
  ageStatement: string
  region: string
}

interface EssentialFieldsCardProps {
  values: EssentialFieldsValues
  onChange: (patch: Partial<EssentialFieldsValues>) => void
  nameError?: string
}

export function EssentialFieldsCard({ values, onChange, nameError }: EssentialFieldsCardProps) {
  const [lookingUp, setLookingUp] = useState(false)
  const [aiStatus, setAiStatus] = useState<string | null>(null)

  async function handleAskAi() {
    const query = values.name.trim()
    if (query.length < 3 || lookingUp) return
    setLookingUp(true)
    setAiStatus(`✨ Asking AI about "${query}"...`)
    try {
      const info = await lookupBottleInfo(query)
      if (!info.known) {
        setAiStatus('No close match yet. Keep typing, or save it manually.')
        return
      }
      onChange({
        distillery: values.distillery.trim() || info.distillery || values.distillery,
        type: values.type.trim() || info.type || values.type,
        region: values.region.trim() || info.region || values.region,
        proof: values.proof || (info.proof ? String(info.proof) : values.proof),
      })
      setAiStatus(`✨ AI filled in ${info.distillery || 'details'} for this bottle.`)
    } catch {
      setAiStatus('No close match yet. Keep typing, or save it manually.')
    } finally {
      setLookingUp(false)
    }
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.cardTitle}>Essential Details</h2>

      <Field label="Bottle name" htmlFor="ab-name" required>
        <input
          id="ab-name"
          className={controlClassName}
          value={values.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Eagle Rare 10 Year"
          required
        />
      </Field>
      {nameError ? (
        <p className={styles.fieldError} role="alert">
          {nameError}
        </p>
      ) : null}

      <button
        type="button"
        className={styles.askAiLink}
        onClick={handleAskAi}
        disabled={lookingUp || values.name.trim().length < 3}
      >
        {lookingUp ? 'Asking AI…' : '✨ Ask AI to fill in the rest'}
      </button>
      {aiStatus ? <p className={styles.aiStatus}>{aiStatus}</p> : null}

      <Field label="Distillery" htmlFor="ab-distillery">
        <Combobox
          id="ab-distillery"
          value={values.distillery}
          onChange={(value) => onChange({ distillery: value })}
          getOptions={(query) => searchDistilleries(query).map(distilleryToOption)}
          placeholder="Buffalo Trace — or Unknown / Undisclosed Source"
        />
      </Field>

      <div className={styles.row}>
        <Field label="Type" htmlFor="ab-type">
          <input
            id="ab-type"
            className={controlClassName}
            value={values.type}
            onChange={(e) => onChange({ type: e.target.value })}
            placeholder="Bourbon"
          />
        </Field>

        <Field label="Proof" htmlFor="ab-proof">
          <input
            id="ab-proof"
            className={controlClassName}
            type="number"
            inputMode="decimal"
            value={values.proof}
            onChange={(e) => onChange({ proof: e.target.value })}
            placeholder="90"
          />
        </Field>
      </div>

      <div className={styles.row}>
        <Field label="Age statement" htmlFor="ab-age">
          <input
            id="ab-age"
            className={controlClassName}
            value={values.ageStatement}
            onChange={(e) => onChange({ ageStatement: e.target.value })}
            placeholder="10 Year"
          />
        </Field>

        <Field label="Region" htmlFor="ab-region">
          <input
            id="ab-region"
            className={controlClassName}
            value={values.region}
            onChange={(e) => onChange({ region: e.target.value })}
            placeholder="Kentucky"
          />
        </Field>
      </div>
    </div>
  )
}
