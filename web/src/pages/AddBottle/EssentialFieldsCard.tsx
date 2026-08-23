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
  bottleSize: string
  mashBillCorn: string
  mashBillRyeWheat: string
  mashBillMalted: string
}

interface EssentialFieldsCardProps {
  values: EssentialFieldsValues
  onChange: (patch: Partial<EssentialFieldsValues>) => void
  nameError?: string
  // MSRP isn't an "essential" field itself (it lives with the ownership/price
  // fields), but the same AI lookup that fills in distillery/type/etc. often
  // finds it too — this hands it back up rather than throwing it away.
  onMsrpFound?: (msrp: number) => void
}

export function EssentialFieldsCard({ values, onChange, nameError, onMsrpFound }: EssentialFieldsCardProps) {
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
        mashBillCorn: values.mashBillCorn || (info.mashBillCorn ? String(info.mashBillCorn) : values.mashBillCorn),
        mashBillRyeWheat: values.mashBillRyeWheat || (info.mashBillRyeWheat ? String(info.mashBillRyeWheat) : values.mashBillRyeWheat),
        mashBillMalted: values.mashBillMalted || (info.mashBillMalted ? String(info.mashBillMalted) : values.mashBillMalted),
      })
      if (info.msrp) onMsrpFound?.(info.msrp)
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

      <Field label="Bottle size in ml (optional)" htmlFor="ab-bottle-size">
        <input
          id="ab-bottle-size"
          className={controlClassName}
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={values.bottleSize}
          onChange={(e) => onChange({ bottleSize: e.target.value })}
          placeholder="750"
        />
      </Field>

      <div className={styles.row}>
        <Field label="Mash bill: Corn % (optional)" htmlFor="ab-mashbill-corn">
          <input
            id="ab-mashbill-corn"
            className={controlClassName}
            type="number"
            inputMode="decimal"
            value={values.mashBillCorn}
            onChange={(e) => onChange({ mashBillCorn: e.target.value })}
            placeholder="75"
          />
        </Field>

        <Field label="Mash bill: Rye/Wheat % (optional)" htmlFor="ab-mashbill-ryewheat">
          <input
            id="ab-mashbill-ryewheat"
            className={controlClassName}
            type="number"
            inputMode="decimal"
            value={values.mashBillRyeWheat}
            onChange={(e) => onChange({ mashBillRyeWheat: e.target.value })}
            placeholder="13"
          />
        </Field>
      </div>

      <Field label="Mash bill: Malted barley % (optional)" htmlFor="ab-mashbill-malted">
        <input
          id="ab-mashbill-malted"
          className={controlClassName}
          type="number"
          inputMode="decimal"
          value={values.mashBillMalted}
          onChange={(e) => onChange({ mashBillMalted: e.target.value })}
          placeholder="12"
        />
      </Field>
    </div>
  )
}
