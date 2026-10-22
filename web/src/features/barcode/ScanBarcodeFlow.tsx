import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Field, controlClassName } from '../../components/ui/Field'
import { useUserData } from '../../hooks/useUserData'
import type { Bottle } from '../../data/types'
import {
  identifyBottleLabel,
  lookupBarcode,
  type BarcodeBottle,
  type BarcodeLookupResult,
  type EntryOrigin,
  type LabelScanResult,
} from '../../data/repositories/barcode'
import { downscaleImageToJpegBase64 } from '../ai/imageToBase64'
import { decodeImageFile, startLiveScan, type DecodedBarcode, type LiveScanner } from './decoder'
import { normalizeBarcode } from './gtin'
import { buildOptions, draftFromLabel, draftFromOption, draftToBottle, type BarcodeOption, type BottleDraft } from './options'
import { findInBar, planIncreaseQuantity, type BarMatches } from './inventory'
import { BarcodeMatchList } from './BarcodeMatchList'
import { BarcodeBottleForm } from './BarcodeBottleForm'
import { BarcodeSaveActions } from './BarcodeSaveActions'
import styles from './ScanBarcodeFlow.module.css'

// Scan Barcode on Add Bottle (docs/BARCODE_POC.md → "How it works"):
//   scan → FIP's catalog + your own saved bottles (free) → pick your
//   release, or ask AXE / scan the front label / enter it yourself → check
//   the details → Add to My Bar / Wishlist (continues in the Add Bottle form,
//   which saves it) or Increase quantity / Move to My Bar on a bottle you
//   already have (saved here, through the same inventory hooks).
// Decoding happens on the phone; AI runs only when the user asks for it.

export interface BarcodeHandoff {
  bottle: BarcodeBottle
  status: 'sealed' | 'wishlist'
  gtin13: string | null
  /** Digits as printed on the bottle, stored in Bottle.upc. */
  printedBarcode: string | null
  origin: EntryOrigin
  candidateId: string | null
  submitForReview: boolean
}

interface ScanBarcodeFlowProps {
  /** Add to My Bar / Wishlist: continue in the Add Bottle form. */
  onUse: (handoff: BarcodeHandoff) => void
  /** Increase quantity / Move to My Bar finished on an existing bottle. */
  onUpdatedExisting: (bottleId: string) => void
  onCancel: () => void
}

type Step = 'scan' | 'choose' | 'details'

const NO_MATCHES: BarMatches = { sameRelease: [], sameBarcode: [] }

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access is off for FIP. Allow it in your browser settings, or take a photo or type the digits below.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera was found. Take a photo or type the digits below.'
  }
  return 'The camera couldn’t start. Take a photo or type the digits below.'
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

export function ScanBarcodeFlow({ onUse, onUpdatedExisting, onCancel }: ScanBarcodeFlowProps) {
  const { userDoc, updateBottle, addBottleInstance } = useUserData()
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<LiveScanner | null>(null)
  const labelInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('scan')
  const [scanning, setScanning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [decoded, setDecoded] = useState<DecodedBarcode | null>(null)
  const [lookup, setLookup] = useState<BarcodeLookupResult | null>(null)
  const [labelScan, setLabelScan] = useState<LabelScanResult | null>(null)
  const [busy, setBusy] = useState<'catalog' | 'axe' | 'label' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<BarcodeOption | null>(null)
  const [draft, setDraft] = useState<BottleDraft | null>(null)
  const [submitForReview, setSubmitForReview] = useState(false)

  const gtin13 = decoded?.normalized.gtin13 ?? null
  const options = useMemo(() => buildOptions(lookup, labelScan), [lookup, labelScan])
  const bottles = userDoc.bottles
  const inBarKeys = useMemo(
    () => new Set(options.filter((o) => findInBar(bottles, gtin13 ?? '', o.bottle, o.bottleId).sameRelease.length > 0).map((o) => o.key)),
    [options, bottles, gtin13],
  )
  const matches = useMemo(
    () => (draft && draft.values.name.trim() ? findInBar(bottles, gtin13 ?? '', draftToBottle(draft), selected?.bottleId) : NO_MATCHES),
    [draft, bottles, gtin13, selected],
  )

  function stopCamera() {
    scannerRef.current?.stop()
    scannerRef.current = null
    setScanning(false)
  }

  async function startCamera() {
    if (!videoRef.current) return
    setCameraError(null)
    setScanning(true)
    try {
      scannerRef.current = await startLiveScan(videoRef.current, (result) => {
        scannerRef.current = null
        setScanning(false)
        void accept(result)
      })
    } catch (err) {
      setScanning(false)
      setCameraError(cameraErrorMessage(err))
    }
  }

  // The user tapped Scan Barcode to get here, so open the camera straight
  // away; always release it when leaving.
  useEffect(() => {
    void startCamera()
    return () => scannerRef.current?.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, [])

  async function accept(result: DecodedBarcode) {
    setDecoded(result)
    setLookup(null)
    setLabelScan(null)
    setSelected(null)
    setDraft(null)
    setError(null)
    setStep('choose')
    if (result.normalized.restricted) return
    setBusy('catalog')
    try {
      setLookup(await lookupBarcode(result.normalized.gtin13))
    } catch (err) {
      setError(errorText(err, 'FIP’s catalog couldn’t be checked. You can still identify the bottle below.'))
    } finally {
      setBusy(null)
    }
  }

  async function decodePhoto(file: File | undefined) {
    if (!file) return
    stopCamera()
    setCameraError(null)
    const result = await decodeImageFile(file)
    if (result) void accept(result)
    else setCameraError('No barcode could be read from that photo. Try again closer and in good light, or type the digits.')
  }

  function useTyped() {
    const normalized = normalizeBarcode(typed)
    if (normalized.error !== undefined) {
      setCameraError('Those digits aren’t a valid UPC or EAN barcode. Check them against the bottle.')
      return
    }
    stopCamera()
    void accept({ raw: typed, format: normalized.symbology, engine: 'zxing', normalized, msToDecode: 0 })
  }

  function scanAgain() {
    setDecoded(null)
    setLookup(null)
    setLabelScan(null)
    setSelected(null)
    setDraft(null)
    setError(null)
    setTyped('')
    setStep('scan')
    void startCamera()
  }

  async function askAxe() {
    if (!gtin13) return
    setBusy('axe')
    setError(null)
    try {
      setLookup(await lookupBarcode(gtin13, { useAxe: true }))
    } catch (err) {
      setError(errorText(err, 'AXE can’t look this barcode up right now.'))
    } finally {
      setBusy(null)
    }
  }

  async function scanLabel(file: File | undefined) {
    if (!file) return
    stopCamera()
    setStep('choose')
    setBusy('label')
    setError(null)
    try {
      const imageBase64 = await downscaleImageToJpegBase64(file, 1280)
      const result = await identifyBottleLabel({ barcode: gtin13, imageBase64, mediaType: 'image/jpeg' })
      setLabelScan(result)
      if (selected) setDraft(draftFromOption(selected, result.axe.label))
    } catch (err) {
      setError(errorText(err, 'AXE can’t read this label right now.'))
    } finally {
      setBusy(null)
      if (labelInputRef.current) labelInputRef.current.value = ''
    }
  }

  function choose(option: BarcodeOption) {
    setSelected(option)
    setDraft(draftFromOption(option, labelScan?.axe.label ?? null))
    setStep('details')
  }

  function enterManually() {
    stopCamera()
    setSelected(null)
    setDraft(draftFromLabel(labelScan?.axe.label ?? null))
    setStep('details')
  }

  function handOff(status: 'sealed' | 'wishlist') {
    if (!draft) return
    onUse({
      bottle: draftToBottle(draft),
      status,
      gtin13,
      printedBarcode: decoded ? decoded.raw.replace(/\D/g, '') : null,
      origin: selected?.origin ?? (labelScan ? 'axe-label' : 'manual'),
      candidateId: selected?.candidateId ?? null,
      submitForReview,
    })
  }

  async function increase(bottle: Bottle) {
    setBusy('save')
    setError(null)
    try {
      const plan = planIncreaseQuantity(bottle, generateId)
      if (plan.kind === 'add-instance') await addBottleInstance(bottle.id)
      else await updateBottle(bottle.id, plan.patch)
      onUpdatedExisting(bottle.id)
    } catch (err) {
      setError(errorText(err, 'That couldn’t be saved. Please try again.'))
    } finally {
      setBusy(null)
    }
  }

  const axe = lookup?.axe
  const label = labelScan?.axe.label

  return (
    <div className={styles.flow}>
      <input
        ref={labelInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label="Front label photo"
        onChange={(e) => void scanLabel(e.target.files?.[0])}
      />

      {/* Always mounted so the camera can restart from any step (Scan again). */}
      <div className={styles.viewfinder} hidden={!scanning}>
        <video ref={videoRef} className={styles.video} playsInline muted />
        <div className={styles.guide} aria-hidden="true" />
      </div>

      {step === 'scan' ? (
        <section className={styles.card} aria-label="Scan barcode">
          <p className={styles.hint}>{scanning ? 'Hold the barcode inside the frame.' : 'Scan the barcode on the bottle.'}</p>
          {cameraError ? (
            <p className={styles.error} role="alert">
              {cameraError}
            </p>
          ) : null}
          <div className={styles.actions}>
            {!scanning ? <Button onClick={() => void startCamera()}>Scan Barcode</Button> : null}
            <label className={styles.fileButton}>
              Take a photo instead
              <input type="file" accept="image/*" capture="environment" onChange={(e) => void decodePhoto(e.target.files?.[0])} />
            </label>
          </div>
          <div className={styles.typed}>
            <Field label="Or type the barcode digits" htmlFor="scan-typed">
              <input
                id="scan-typed"
                className={controlClassName}
                inputMode="numeric"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
            </Field>
            <Button variant="secondary" onClick={useTyped} disabled={!typed.trim()}>
              Look up
            </Button>
          </div>
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => labelInputRef.current?.click()}>
              No barcode? Scan Front Label with AXE
            </Button>
            <Button variant="ghost" onClick={enterManually}>
              Enter details manually
            </Button>
          </div>
        </section>
      ) : null}

      {step !== 'scan' && decoded ? (
        <div className={styles.scanned}>
          <span>
            Barcode <strong>{decoded.raw.replace(/\D/g, '')}</strong>
          </span>
          <Button variant="ghost" onClick={scanAgain}>
            Scan again
          </Button>
        </div>
      ) : null}

      {step === 'choose' ? (
        <section className={styles.card} aria-label="Which bottle is it?">
          <h2 className={styles.heading}>Which bottle is it?</h2>
          {decoded?.normalized.restricted ? (
            <p className={styles.hint}>
              That’s a store’s own price label, not the product barcode. Look for the printed UPC, or scan the front label.
            </p>
          ) : null}
          {busy === 'catalog' ? <p className={styles.hint}>Checking FIP’s catalog…</p> : null}
          {busy === 'label' ? <p className={styles.hint}>AXE is reading the label…</p> : null}
          {axe && !axe.identified ? <p className={styles.hint}>AXE couldn’t tie this barcode to a product.</p> : null}
          {labelScan && !labelScan.axe.identified ? <p className={styles.hint}>AXE couldn’t identify the bottle from that label.</p> : null}
          {label ? (
            <p className={styles.hint}>
              Read from your label:{' '}
              {[
                label.name,
                label.proof != null ? `${label.proof} proof` : null,
                label.batch ? `batch ${label.batch}` : null,
                label.barrel ? `barrel ${label.barrel}` : null,
                label.storePick ? `${label.storePick} pick` : null,
                label.ageStatement,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          {busy !== 'catalog' ? (
            <BarcodeMatchList
              options={options}
              selectedKey={selected?.key ?? null}
              inBarKeys={inBarKeys}
              onSelect={choose}
              onAskAxe={gtin13 && !decoded?.normalized.restricted && !axe ? () => void askAxe() : undefined}
              askAxeBusy={busy === 'axe'}
              onScanLabel={() => labelInputRef.current?.click()}
              scanLabelBusy={busy === 'label'}
              onManual={enterManually}
            />
          ) : null}
        </section>
      ) : null}

      {step === 'details' && draft ? (
        <section className={styles.card} aria-label="Check the details">
          <h2 className={styles.heading}>Check the details</h2>
          <p className={styles.hint}>
            {selected
              ? selected.trust === 'verified'
                ? 'From FIP’s verified catalog.'
                : selected.trust === 'yours'
                  ? 'From what you saved before.'
                  : 'An AXE suggestion — not verified. Check it against your label.'
              : 'Enter what the label says.'}{' '}
            Batch, barrel and proof come only from FIP’s verified catalog or your own label.
          </p>
          <BarcodeBottleForm draft={draft} onChange={setDraft} />
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <BarcodeSaveActions
            matches={matches}
            canSave={Boolean(draft.values.name.trim())}
            busy={busy === 'save'}
            submitForReview={submitForReview}
            onSubmitForReviewChange={setSubmitForReview}
            onAdd={handOff}
            onIncrease={(bottle) => void increase(bottle)}
          />
          <Button variant="ghost" onClick={() => setStep(decoded || labelScan ? 'choose' : 'scan')}>
            Back
          </Button>
        </section>
      ) : null}

      <Button variant="ghost" onClick={onCancel}>
        Cancel scanning
      </Button>
    </div>
  )
}
