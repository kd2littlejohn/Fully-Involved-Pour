import { useEffect, useRef, useState } from 'react'
import { Field, controlClassName } from '../../components/ui/Field'
import { Combobox } from '../../components/ui/Combobox'
import { lookupBottleInfo, lookupDistillery, type DistilleryInfoResult } from '../../data/repositories/ai'
import { distilleryToOption, searchDistilleries } from '../../data/distillery/search'
import styles from './FieldsCard.module.css'

export interface EssentialFieldsValues {
  name: string
  distillery: string
  type: string
  proof: string
  ageStatement: string
  region: string
  mashBillCorn: string
  mashBillRyeWheat: string
  mashBillMalted: string
}

interface EssentialFieldsCardProps {
  values: EssentialFieldsValues
  onChange: (patch: Partial<EssentialFieldsValues>) => void
  nameError?: string
}

// How long to let typing settle before auto-firing the lookup — long enough
// that mid-word keystrokes never trigger a call, short enough that it feels
// immediate once you stop typing the name.
const AUTO_LOOKUP_DEBOUNCE_MS = 900

function hasBlankTarget(values: EssentialFieldsValues): boolean {
  return (
    !values.distillery.trim() ||
    !values.type.trim() ||
    !values.region.trim() ||
    !values.proof ||
    !values.ageStatement.trim() ||
    !values.mashBillCorn ||
    !values.mashBillRyeWheat ||
    !values.mashBillMalted
  )
}

interface DistilleryBioState {
  name: string
  loading: boolean
  info: DistilleryInfoResult | null
}

export function EssentialFieldsCard({ values, onChange, nameError }: EssentialFieldsCardProps) {
  const [lookingUp, setLookingUp] = useState(false)
  const [aiStatus, setAiStatus] = useState<string | null>(null)
  const [distilleryBio, setDistilleryBio] = useState<DistilleryBioState | null>(null)
  // The exact name we've already auto-looked-up, so typing elsewhere (or a
  // re-render) never re-fires the same query — only a genuinely new name does.
  const autoLookupDoneForRef = useRef<string | null>(null)

  // Fires only right after AI supplies the distillery — not on every manual
  // edit of the field, which would mean a lookup call on every keystroke.
  // Ephemeral by design (never saved to the bottle), same as DistilleryList's
  // own use of this same lookupDistillery call — a brief, disposable bio for
  // "here's what AI just filled in," not a persisted distillery profile.
  async function loadDistilleryBio(distilleryName: string) {
    setDistilleryBio({ name: distilleryName, loading: true, info: null })
    try {
      const info = await lookupDistillery(distilleryName)
      setDistilleryBio({ name: distilleryName, loading: false, info })
    } catch {
      setDistilleryBio({ name: distilleryName, loading: false, info: { known: false } })
    }
  }

  async function runLookup(auto: boolean) {
    const query = values.name.trim()
    if (query.length < 3 || lookingUp) return
    setLookingUp(true)
    if (!auto) setAiStatus(`✨ Asking AI about "${query}"...`)
    const distilleryWasBlank = !values.distillery.trim()
    try {
      const info = await lookupBottleInfo(query)
      if (!info.known) {
        // A silent no-op for the background auto-run — most typed names
        // simply won't match a known product, and surfacing that as
        // unsolicited "no match" feedback while someone is still typing
        // reads as an error rather than the non-event it is. The manual
        // button still reports it, since that's an explicit ask.
        if (!auto) setAiStatus('No close match yet. Keep typing, or save it manually.')
        return
      }
      onChange({
        distillery: values.distillery.trim() || info.distillery || values.distillery,
        type: values.type.trim() || info.type || values.type,
        region: values.region.trim() || info.region || values.region,
        proof: values.proof || (info.proof ? String(info.proof) : values.proof),
        ageStatement: values.ageStatement.trim() || info.ageStatement || values.ageStatement,
        mashBillCorn: values.mashBillCorn || (info.mashBillCorn ? String(info.mashBillCorn) : values.mashBillCorn),
        mashBillRyeWheat:
          values.mashBillRyeWheat || (info.mashBillRyeWheat ? String(info.mashBillRyeWheat) : values.mashBillRyeWheat),
        mashBillMalted: values.mashBillMalted || (info.mashBillMalted ? String(info.mashBillMalted) : values.mashBillMalted),
      })
      setAiStatus(`✨ AI filled in ${info.distillery || 'details'} for this bottle.`)
      if (distilleryWasBlank && info.distillery) void loadDistilleryBio(info.distillery)
    } catch {
      if (!auto) setAiStatus('No close match yet. Keep typing, or save it manually.')
    } finally {
      setLookingUp(false)
    }
  }

  // Auto-fires once there's a real bottle name to search on — no click
  // needed. Runs the same for a fresh Add Bottle (as soon as you finish
  // typing the name) and for Edit Bottle on an existing bottle (fires right
  // after the form hydrates, if that bottle is still missing any of these
  // fields), since both just mean "the name changed and we haven't already
  // looked this one up."
  useEffect(() => {
    const query = values.name.trim()
    if (query.length < 3 || lookingUp) return
    if (autoLookupDoneForRef.current === query) return
    if (!hasBlankTarget(values)) return
    const timer = setTimeout(() => {
      autoLookupDoneForRef.current = query
      void runLookup(true)
    }, AUTO_LOOKUP_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the name should re-trigger this; re-running on every field edit would refire mid-fill
  }, [values.name])

  function handleAskAi() {
    void runLookup(false)
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

      {distilleryBio && distilleryBio.name === values.distillery ? (
        <div className={styles.distilleryBio}>
          {distilleryBio.loading ? (
            <p className={styles.aiStatus}>Looking up {distilleryBio.name}…</p>
          ) : distilleryBio.info?.known ? (
            <>
              <p className={styles.distilleryBioMeta}>
                {[distilleryBio.info.location, distilleryBio.info.founded ? `founded ${distilleryBio.info.founded}` : null]
                  .filter(Boolean)
                  .join(' · ')}
                {distilleryBio.info.parentCompany ? ` · owned by ${distilleryBio.info.parentCompany}` : ''}
              </p>
              {distilleryBio.info.description ? <p className={styles.distilleryBioText}>{distilleryBio.info.description}</p> : null}
            </>
          ) : null}
        </div>
      ) : null}

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

      <p className={styles.groupLabel}>Mash Bill (optional)</p>
      <div className={styles.row3}>
        <Field label="Corn %" htmlFor="ab-mashbill-corn">
          <input
            id="ab-mashbill-corn"
            className={controlClassName}
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            value={values.mashBillCorn}
            onChange={(e) => onChange({ mashBillCorn: e.target.value })}
            placeholder="75"
          />
        </Field>

        <Field label="Rye/Wheat %" htmlFor="ab-mashbill-ryewheat">
          <input
            id="ab-mashbill-ryewheat"
            className={controlClassName}
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            value={values.mashBillRyeWheat}
            onChange={(e) => onChange({ mashBillRyeWheat: e.target.value })}
            placeholder="21"
          />
        </Field>

        <Field label="Malted %" htmlFor="ab-mashbill-malted">
          <input
            id="ab-mashbill-malted"
            className={controlClassName}
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            value={values.mashBillMalted}
            onChange={(e) => onChange({ mashBillMalted: e.target.value })}
            placeholder="4"
          />
        </Field>
      </div>
    </div>
  )
}
