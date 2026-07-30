import { useState, type ChangeEvent, type FormEvent } from 'react'
import type { BottleStatus } from '../../data/types'
import { Field, controlClassName } from '../ui/Field'
import { Button } from '../ui/Button'
import { PhotoUploadField } from '../../features/photoUpload/PhotoUploadField'
import { downscaleImageToJpegBase64 } from '../../features/ai/imageToBase64'
import { scanBottleLabel, lookupBottleInfo } from '../../data/repositories/ai'
import styles from './AddBottleForm.module.css'

export interface AddBottleFormInput {
  name: string
  distillery?: string
  type?: string
  status: BottleStatus
  proof?: number
  region?: string
  ageStatement?: string
  msrp?: number
  imageUrl?: string
}

interface AddBottleFormProps {
  onSubmit: (input: AddBottleFormInput) => Promise<void>
  onCancel: () => void
  defaultStatus?: BottleStatus
  initialValues?: Partial<AddBottleFormInput>
}

const STATUS_OPTIONS: { value: BottleStatus; label: string }[] = [
  { value: 'sealed', label: 'Sealed' },
  { value: 'open', label: 'Opened' },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'finished', label: 'Finished' },
]

export function AddBottleForm({ onSubmit, onCancel, defaultStatus = 'sealed', initialValues }: AddBottleFormProps) {
  const [name, setName] = useState(initialValues?.name ?? '')
  const [distillery, setDistillery] = useState(initialValues?.distillery ?? '')
  const [type, setType] = useState(initialValues?.type ?? '')
  const [status, setStatus] = useState<BottleStatus>(initialValues?.status ?? defaultStatus)
  const [proof, setProof] = useState(initialValues?.proof ? String(initialValues.proof) : '')
  const [region, setRegion] = useState(initialValues?.region ?? '')
  const [ageStatement, setAgeStatement] = useState(initialValues?.ageStatement ?? '')
  const [msrp, setMsrp] = useState(initialValues?.msrp ? String(initialValues.msrp) : '')
  const [imageUrl, setImageUrl] = useState<string | undefined>(initialValues?.imageUrl)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [scanning, setScanning] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [aiStatus, setAiStatus] = useState<string | null>(null)

  async function handleScanLabel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setScanning(true)
    setAiStatus('Reading label…')
    try {
      const base64 = await downscaleImageToJpegBase64(file)
      const info = await scanBottleLabel(base64, 'image/jpeg')
      if (!info.found) {
        setAiStatus("Couldn't read a bottle label in that photo. Try a clearer, closer shot.")
        return
      }
      if (!name.trim() && info.name) setName(info.name)
      if (!distillery.trim() && info.distillery) setDistillery(info.distillery)
      if (info.type) setType(info.type)
      if (!region.trim() && info.region) setRegion(info.region)
      if (!proof && info.proof) setProof(String(info.proof))
      if (!ageStatement.trim() && info.ageStatement) setAgeStatement(info.ageStatement)
      if (!msrp && info.msrp) setMsrp(String(info.msrp))
      setAiStatus(`✨ AI filled in ${info.distillery || 'details'} from the label.`)
    } catch {
      setAiStatus('Could not read that photo. Try again or enter details manually.')
    } finally {
      setScanning(false)
    }
  }

  async function handleAskAi() {
    const query = name.trim()
    if (query.length < 3 || lookingUp) return
    setLookingUp(true)
    setAiStatus(`✨ Asking AI about "${query}"...`)
    try {
      const info = await lookupBottleInfo(query)
      if (!info.known) {
        setAiStatus('No close match yet. Keep typing, or save it manually.')
        return
      }
      if (!distillery.trim() && info.distillery) setDistillery(info.distillery)
      if (info.type) setType(info.type)
      if (!region.trim() && info.region) setRegion(info.region)
      if (!proof && info.proof) setProof(String(info.proof))
      setAiStatus(`✨ AI filled in ${info.distillery || 'details'} for this bottle.`)
    } catch {
      setAiStatus('No close match yet. Keep typing, or save it manually.')
    } finally {
      setLookingUp(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Bottle name is required.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        distillery: distillery.trim() || undefined,
        type: type.trim() || undefined,
        status,
        proof: proof ? Number(proof) : undefined,
        region: region.trim() || undefined,
        ageStatement: ageStatement.trim() || undefined,
        msrp: msrp ? Number(msrp) : undefined,
        imageUrl,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <label className={styles.scanButton}>
        {scanning ? 'Reading label…' : '✨ Scan label with AI'}
        <input
          type="file"
          accept="image/*"
          className={styles.hiddenFileInput}
          onChange={handleScanLabel}
          disabled={scanning}
        />
      </label>

      <Field label="Bottle name" htmlFor="bottle-name">
        <div className={styles.nameRow}>
          <input
            id="bottle-name"
            className={controlClassName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Eagle Rare 10 Year"
            required
          />
          <Button type="button" variant="ghost" onClick={handleAskAi} disabled={lookingUp || name.trim().length < 3}>
            {lookingUp ? '…' : '✨ Ask AI'}
          </Button>
        </div>
      </Field>

      {aiStatus ? <p className={styles.aiStatus}>{aiStatus}</p> : null}

      <Field label="Distillery" htmlFor="bottle-distillery">
        <input
          id="bottle-distillery"
          className={controlClassName}
          value={distillery}
          onChange={(e) => setDistillery(e.target.value)}
          placeholder="Buffalo Trace"
        />
      </Field>

      <Field label="Type" htmlFor="bottle-type">
        <input
          id="bottle-type"
          className={controlClassName}
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="Bourbon"
        />
      </Field>

      <Field label="Region (optional)" htmlFor="bottle-region">
        <input
          id="bottle-region"
          className={controlClassName}
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="Kentucky"
        />
      </Field>

      <Field label="Status" htmlFor="bottle-status">
        <select
          id="bottle-status"
          className={controlClassName}
          value={status}
          onChange={(e) => setStatus(e.target.value as BottleStatus)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Proof (optional)" htmlFor="bottle-proof">
        <input
          id="bottle-proof"
          className={controlClassName}
          type="number"
          inputMode="decimal"
          value={proof}
          onChange={(e) => setProof(e.target.value)}
          placeholder="90"
        />
      </Field>

      <Field label="Age statement (optional)" htmlFor="bottle-age-statement">
        <input
          id="bottle-age-statement"
          className={controlClassName}
          value={ageStatement}
          onChange={(e) => setAgeStatement(e.target.value)}
          placeholder="10 Year"
        />
      </Field>

      <Field label="MSRP (optional)" htmlFor="bottle-msrp">
        <input
          id="bottle-msrp"
          className={controlClassName}
          type="number"
          inputMode="decimal"
          value={msrp}
          onChange={(e) => setMsrp(e.target.value)}
          placeholder="40"
        />
      </Field>

      <PhotoUploadField label="Bottle photo (optional)" folder="bottle-photos" currentUrl={imageUrl} onUploaded={setImageUrl} />

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add Bottle'}
        </Button>
      </div>
    </form>
  )
}
