import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Field, controlClassName } from '../../components/ui/Field'
import { PageHeader } from '../../components/layout/PageHeader'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { isMockAuthEnabled } from '../../data/devMode'
import type { Bottle } from '../../data/types'
import {
  identifyBottleLabel,
  lookupBarcode,
  saveBarcodeEntry,
  type BarcodeLookupResult,
  type LabelScanResult,
} from '../../data/repositories/barcode'
import {
  decodeImageFile,
  hasNativeDetector,
  startLiveScan,
  type DecodedBarcode,
  type EnginePreference,
  type LiveScanner,
  type LiveScanStats,
} from '../../features/barcode/decoder'
import { normalizeBarcode } from '../../features/barcode/gtin'
import { buildOptions, draftFromLabel, draftFromOption, draftToBottle, type BarcodeOption, type BottleDraft } from '../../features/barcode/options'
import { buildNewBottleInput, findInBar, planIncreaseQuantity, type BarMatches } from '../../features/barcode/inventory'
import { BarcodeMatchList } from '../../features/barcode/BarcodeMatchList'
import { BarcodeBottleForm } from '../../features/barcode/BarcodeBottleForm'
import { BarcodeSaveActions } from '../../features/barcode/BarcodeSaveActions'
import { downscaleImageToJpegBase64, resizeImageFile } from '../../features/ai/imageToBase64'
import styles from './BarcodePocPage.module.css'

// Scan Barcode — Phase 0 proof of concept. Dev builds only (see router.tsx):
// never part of the production app, and never linked from Add Bottle.
//
// The flow it proves out (docs/BARCODE_POC.md):
//   scan → FIP catalog + your own saved entries (free) → pick your release
//   from the candidates, or ask AXE / scan the front label / type it →
//   check the details (every value tagged with where it came from) →
//   Increase Quantity on a bottle you already have, or add to My Bar or
//   Wishlist through the existing inventory hooks.
// It also records ground truth for the 30-bottle test and exports the CSV
// that scripts/barcode-poc.js grades Claude and Gemini against.

type VariantKind = 'standard' | 'barrel-proof-batch' | 'single-barrel' | 'store-pick'

interface SampleRow {
  at: string
  gtin13: string
  upcA: string
  symbology: string
  mode: 'live' | 'photo' | 'typed'
  engine: string
  msToCamera: number | ''
  msToDecode: number | ''
  rejectedReads: number | ''
  catalogStatus: string
  verifiedCandidates: number | ''
  expectedName: string
  expectedDistillery: string
  expectedProof: string
  expectedBatch: string
  variantKind: VariantKind
  device: string
}

const SAMPLES_KEY = 'fip-barcode-poc-samples'
const VARIANT_LABELS: Record<VariantKind, string> = {
  standard: 'Standard release',
  'barrel-proof-batch': 'Barrel-proof batch',
  'single-barrel': 'Single barrel',
  'store-pick': 'Store pick',
}
const USING_EMULATORS = import.meta.env.VITE_FIREBASE_EMULATORS === 'true'

function readSamples(): SampleRow[] {
  try {
    return JSON.parse(localStorage.getItem(SAMPLES_KEY) || '[]') as SampleRow[]
  } catch {
    return []
  }
}

function writeSamples(rows: SampleRow[]) {
  try {
    localStorage.setItem(SAMPLES_KEY, JSON.stringify(rows))
  } catch {
    // Private mode / storage full — the in-memory list still exports.
  }
}

function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function money(value: number | null | undefined): string {
  return typeof value === 'number' ? `$${value.toFixed(value < 0.1 ? 4 : 2)}` : '–'
}

const NO_MATCHES: BarMatches = { sameRelease: [], sameBarcode: [] }

export function BarcodePocPage() {
  const { user } = useAuth()
  const { userDoc, addBottle, updateBottle, addBottleInstance } = useUserData()
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<LiveScanner | null>(null)
  const labelInputRef = useRef<HTMLInputElement>(null)

  const [nativeAvailable, setNativeAvailable] = useState<boolean | null>(null)
  const [enginePref, setEnginePref] = useState<EnginePreference>('auto')
  const [confirmations, setConfirmations] = useState(2)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [decoded, setDecoded] = useState<DecodedBarcode | null>(null)
  const [mode, setMode] = useState<SampleRow['mode']>('live')
  const [stats, setStats] = useState<LiveScanStats | null>(null)
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null)
  const [typed, setTyped] = useState('')

  const [lookup, setLookup] = useState<BarcodeLookupResult | null>(null)
  const [catalogMs, setCatalogMs] = useState<number | null>(null)
  const [axeMs, setAxeMs] = useState<number | null>(null)
  const [busy, setBusy] = useState<'catalog' | 'axe' | 'label' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [labelScan, setLabelScan] = useState<LabelScanResult | null>(null)
  const [labelMs, setLabelMs] = useState<number | null>(null)
  const [labelPhoto, setLabelPhoto] = useState<File | null>(null)

  const [selected, setSelected] = useState<BarcodeOption | null>(null)
  const [draft, setDraft] = useState<BottleDraft | null>(null)
  const [submitForReview, setSubmitForReview] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)

  const [expectedName, setExpectedName] = useState('')
  const [expectedDistillery, setExpectedDistillery] = useState('')
  const [expectedProof, setExpectedProof] = useState('')
  const [expectedBatch, setExpectedBatch] = useState('')
  const [variantKind, setVariantKind] = useState<VariantKind>('standard')
  const [samples, setSamples] = useState<SampleRow[]>(readSamples)

  useEffect(() => {
    void hasNativeDetector().then(setNativeAvailable)
    return () => scannerRef.current?.stop()
  }, [])

  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.url) : undefined), [photo])

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

  function resetResult() {
    setDecoded(null)
    setStats(null)
    setLookup(null)
    setCatalogMs(null)
    setAxeMs(null)
    setLabelScan(null)
    setLabelMs(null)
    setLabelPhoto(null)
    setSelected(null)
    setDraft(null)
    setError(null)
    setSaveStatus(null)
  }

  // Every decoded barcode is checked against FIP's catalog and the user's
  // own entries straight away: Firestore only, no AI cost.
  async function runCatalogLookup(code: string) {
    setBusy('catalog')
    setError(null)
    const started = performance.now()
    try {
      setLookup(await lookupBarcode(code))
      setCatalogMs(Math.round(performance.now() - started))
    } catch (err) {
      setError(err instanceof Error ? `Catalog lookup failed: ${err.message}` : 'Catalog lookup failed.')
    } finally {
      setBusy(null)
    }
  }

  function accept(result: DecodedBarcode) {
    setDecoded(result)
    if (!result.normalized.restricted) void runCatalogLookup(result.normalized.gtin13)
  }

  async function startScan() {
    if (!videoRef.current) return
    resetResult()
    setScanError(null)
    setScanning(true)
    setMode('live')
    try {
      const scanner = await startLiveScan(
        videoRef.current,
        (result) => {
          setStats({ ...scanner.stats })
          setScanning(false)
          accept(result)
        },
        { engine: enginePref, confirmations },
      )
      scannerRef.current = scanner
    } catch (err) {
      setScanning(false)
      setScanError(err instanceof Error ? `${err.name}: ${err.message}` : 'The camera could not start.')
    }
  }

  function stopScan() {
    if (scannerRef.current) setStats({ ...scannerRef.current.stats })
    scannerRef.current?.stop()
    scannerRef.current = null
    setScanning(false)
  }

  async function decodePhoto(file: File | undefined) {
    if (!file) return
    resetResult()
    setScanError(null)
    setMode('photo')
    setPhoto({ file, url: URL.createObjectURL(file) })
    const result = await decodeImageFile(file, enginePref)
    if (result) accept(result)
    else setScanError('No valid UPC-A, UPC-E or EAN-13 found in that photo. Try again, scan the front label, or type the digits.')
  }

  function useTyped() {
    resetResult()
    const normalized = normalizeBarcode(typed)
    if (normalized.error !== undefined) {
      setScanError(`Not a valid barcode (${normalized.error}).`)
      return
    }
    setScanError(null)
    setMode('typed')
    accept({ raw: typed, format: normalized.symbology, engine: 'zxing', normalized, msToDecode: 0 })
  }

  async function askAxe() {
    if (!gtin13) return
    setBusy('axe')
    setError(null)
    const started = performance.now()
    try {
      setLookup(await lookupBarcode(gtin13, { useAxe: true }))
      setAxeMs(Math.round(performance.now() - started))
    } catch (err) {
      setError(err instanceof Error ? err.message : "AXE can't look this barcode up right now.")
    } finally {
      setBusy(null)
    }
  }

  async function scanLabel(file: File | undefined) {
    if (!file) return
    setBusy('label')
    setError(null)
    setLabelPhoto(file)
    const started = performance.now()
    try {
      const imageBase64 = await downscaleImageToJpegBase64(file, 1280)
      const result = await identifyBottleLabel({ barcode: gtin13, imageBase64, mediaType: 'image/jpeg' })
      setLabelMs(Math.round(performance.now() - started))
      setLabelScan(result)
      // Re-apply what the label shows to a bottle already being edited.
      if (selected) setDraft(draftFromOption(selected, result.axe.label))
    } catch (err) {
      setError(err instanceof Error ? err.message : "AXE can't read this label right now.")
    } finally {
      setBusy(null)
      if (labelInputRef.current) labelInputRef.current.value = ''
    }
  }

  function choose(option: BarcodeOption) {
    setSelected(option)
    setDraft(draftFromOption(option, labelScan?.axe.label ?? null))
    setSaveStatus(null)
  }

  function enterManually() {
    setSelected(null)
    setDraft(draftFromLabel(labelScan?.axe.label ?? null))
    setSaveStatus(null)
  }

  // Remembers what this barcode turned out to be, privately, so the next
  // scan answers from it for free. Skipped without a real barcode or user.
  async function recordEntry(bottleId: string | undefined) {
    if (!user || isMockAuthEnabled() || !gtin13 || !draft) return 'not recorded (no barcode or no signed-in user)'
    if (lookup?.yours.some((e) => e.bottleId && e.bottleId === bottleId)) return 'already remembered'
    await saveBarcodeEntry(user.uid, {
      gtin13,
      bottle: draftToBottle(draft),
      origin: selected?.origin ?? 'manual',
      candidateId: selected?.candidateId ?? null,
      bottleId: bottleId ?? null,
      submitForReview,
    })
    return submitForReview ? 'remembered for your scans, and suggested for FIP review' : 'remembered for your scans'
  }

  async function save(action: () => Promise<{ bottleId: string | undefined; message: string }>) {
    setBusy('save')
    setSaveStatus(null)
    try {
      const { bottleId, message } = await action()
      const entry = await recordEntry(bottleId)
      setSaveStatus(`${message} Barcode ${entry}.`)
      if (gtin13) void runCatalogLookup(gtin13)
    } catch (err) {
      setSaveStatus(err instanceof Error ? `Not saved: ${err.message}` : 'Not saved.')
    } finally {
      setBusy(null)
    }
  }

  function addNew(status: 'sealed' | 'wishlist') {
    if (!draft) return
    const printed = decoded ? decoded.raw.replace(/\D/g, '') : ''
    void save(async () => {
      const input = buildNewBottleInput(draftToBottle(draft), status, printed)
      if (!printed) delete input.upc
      const bottleId = await addBottle(input)
      return { bottleId, message: `Added "${input.name}" to ${status === 'wishlist' ? 'Wishlist' : 'My Bar'}.` }
    })
  }

  function increase(bottle: Bottle) {
    void save(async () => {
      const plan = planIncreaseQuantity(bottle, generateId)
      if (plan.kind === 'add-instance') await addBottleInstance(bottle.id)
      else await updateBottle(bottle.id, plan.patch)
      const message =
        plan.kind === 'move-to-bar'
          ? `Moved "${bottle.name}" from Wishlist to My Bar.`
          : `"${bottle.name}" now has ${plan.kind === 'update' ? plan.quantity : (bottle.instances?.length ?? 1) + 1} bottles.`
      return { bottleId: bottle.id, message }
    })
  }

  function recordSample() {
    if (!decoded) return
    const row: SampleRow = {
      at: new Date().toISOString(),
      gtin13: decoded.normalized.gtin13,
      upcA: decoded.normalized.upcA ?? '',
      symbology: decoded.normalized.symbology,
      mode,
      engine: mode === 'typed' ? 'typed' : decoded.engine,
      msToCamera: mode === 'live' ? (stats?.msToCamera ?? '') : '',
      msToDecode: mode === 'typed' ? '' : decoded.msToDecode,
      rejectedReads: mode === 'live' ? (stats?.rejectedReads ?? '') : '',
      catalogStatus: lookup?.status ?? '',
      verifiedCandidates: lookup ? lookup.verified.length : '',
      expectedName: expectedName.trim(),
      expectedDistillery: expectedDistillery.trim(),
      expectedProof: expectedProof.trim(),
      expectedBatch: expectedBatch.trim(),
      variantKind,
      device: navigator.userAgent,
    }
    const next = [...samples, row]
    setSamples(next)
    writeSamples(next)
    setExpectedName('')
    setExpectedDistillery('')
    setExpectedProof('')
    setExpectedBatch('')
    setVariantKind('standard')
  }

  function exportCsv() {
    const header = [
      'gtin13', 'upc_a', 'symbology', 'expected_name', 'expected_distillery', 'expected_proof', 'expected_batch',
      'variant_kind', 'mode', 'engine', 'ms_to_camera', 'ms_to_decode', 'rejected_reads', 'catalog_status',
      'verified_candidates', 'device', 'recorded_at',
    ]
    const lines = samples.map((s) =>
      [
        s.gtin13, s.upcA, s.symbology, s.expectedName, s.expectedDistillery, s.expectedProof, s.expectedBatch,
        s.variantKind, s.mode, s.engine, s.msToCamera, s.msToDecode, s.rejectedReads, s.catalogStatus,
        s.verifiedCandidates, s.device, s.at,
      ].map(csvCell).join(','),
    )
    downloadBlob(new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' }), 'barcode-poc-sample.csv')
  }

  function clearSamples() {
    if (!window.confirm(`Delete all ${samples.length} recorded samples on this device?`)) return
    setSamples([])
    writeSamples([])
  }

  const axe = lookup?.axe
  const labelReading = labelScan?.axe.label

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Development only"
        title="Barcode PoC"
        subtitle="Scan, pick your release, and add it — and record ground truth for the Phase 0 test."
      />

      <section className={styles.card}>
        <h2 className={styles.heading}>This device</h2>
        <dl className={styles.facts}>
          <dt>Secure context (camera allowed)</dt>
          <dd>{window.isSecureContext ? 'Yes' : 'No — camera needs HTTPS'}</dd>
          <dt>Built-in barcode detector</dt>
          <dd>{nativeAvailable === null ? 'Checking…' : nativeAvailable ? 'Yes (UPC-A, UPC-E, EAN-13)' : 'No — ZXing will be used'}</dd>
          <dt>Saving goes to</dt>
          <dd>
            {isMockAuthEnabled()
              ? 'Mock data (nothing is written)'
              : USING_EMULATORS
                ? 'The local emulators'
                : 'The signed-in account’s real My Bar'}
          </dd>
          <dt>Browser</dt>
          <dd className={styles.small}>{navigator.userAgent}</dd>
        </dl>
        <div className={styles.row}>
          <Field label="Decoder" htmlFor="poc-engine">
            <select id="poc-engine" className={controlClassName} value={enginePref} onChange={(e) => setEnginePref(e.target.value as EnginePreference)}>
              <option value="auto">Auto</option>
              <option value="zxing">ZXing</option>
              <option value="native" disabled={!nativeAvailable}>Built-in detector</option>
            </select>
          </Field>
          <Field label="Matching reads required" htmlFor="poc-confirmations">
            <select id="poc-confirmations" className={controlClassName} value={confirmations} onChange={(e) => setConfirmations(Number(e.target.value))}>
              <option value={1}>1 (fastest)</option>
              <option value={2}>2 (default)</option>
              <option value={3}>3</option>
            </select>
          </Field>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.heading}>1. Scan</h2>
        <div className={styles.viewfinder} hidden={!scanning}>
          <video ref={videoRef} className={styles.video} playsInline muted />
          <div className={styles.guide} aria-hidden="true" />
        </div>
        <div className={styles.actions}>
          {scanning ? (
            <Button variant="secondary" onClick={stopScan}>Stop camera</Button>
          ) : (
            <Button onClick={startScan}>Scan Barcode</Button>
          )}
          <label className={styles.fileButton}>
            Decode a photo
            <input type="file" accept="image/*" capture="environment" onChange={(e) => void decodePhoto(e.target.files?.[0])} />
          </label>
        </div>
        <div className={styles.row}>
          <Field label="Or type the digits" htmlFor="poc-typed">
            <input id="poc-typed" className={controlClassName} inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </Field>
          <Button variant="ghost" onClick={useTyped} disabled={!typed.trim()}>Use</Button>
        </div>
        {scanError ? <p className={styles.error} role="alert">{scanError}</p> : null}
        {decoded ? (
          <dl className={styles.facts}>
            <dt>Barcode (as printed)</dt>
            <dd>{decoded.raw.replace(/\D/g, '')} ({decoded.normalized.symbology}{decoded.normalized.restricted ? ', store label' : ''})</dd>
            <dt>Key (GTIN-13)</dt>
            <dd>{decoded.normalized.gtin13}</dd>
            <dt>Decoder</dt>
            <dd>{mode === 'typed' ? 'Typed' : `${decoded.engine} · ${mode}`}</dd>
            {mode !== 'typed' ? (
              <>
                <dt>Time to decode</dt>
                <dd>{decoded.msToDecode} ms{stats ? ` (camera ready in ${stats.msToCamera} ms, ${stats.rejectedReads} rejected reads)` : ''}</dd>
              </>
            ) : null}
          </dl>
        ) : null}
        {decoded?.normalized.restricted ? (
          <p className={styles.small}>This is a store-applied label, not the product barcode. Look for the printed UPC, or scan the front label.</p>
        ) : null}
        {photo && decoded ? (
          <Button
            variant="ghost"
            onClick={() => void resizeImageFile(photo.file, 1600).then((jpeg) => downloadBlob(jpeg, `${decoded.normalized.gtin13}.jpg`))}
          >
            Save barcode photo for the AI photo test
          </Button>
        ) : null}
        {!decoded ? (
          <Button variant="ghost" onClick={() => labelInputRef.current?.click()} disabled={busy === 'label'}>
            {busy === 'label' ? 'Reading label…' : 'No barcode? Scan Front Label with AXE'}
          </Button>
        ) : null}
        <input
          ref={labelInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => void scanLabel(e.target.files?.[0])}
        />
      </section>

      {decoded || labelScan ? (
        <section className={styles.card}>
          <h2 className={styles.heading}>2. Which bottle is it?</h2>
          {busy === 'catalog' ? <p className={styles.small}>Checking FIP’s catalog…</p> : null}
          <p className={styles.badge}>
            {catalogMs != null ? `Catalog ${catalogMs} ms (no AI cost)` : ''}
            {axe ? ` · AXE ${axeMs ?? '–'} ms, ${axe.cached ? 'reused a recent suggestion, $0' : money(lookup?.costUsd)}` : ''}
            {labelScan ? ` · Label ${labelMs ?? '–'} ms, ${money(labelScan.costUsd)}` : ''}
          </p>
          {axe && !axe.identified ? <p className={styles.small}>AXE couldn’t tie this barcode to a product.</p> : null}
          {labelScan && !labelScan.axe.identified ? <p className={styles.small}>AXE couldn’t identify the bottle from that label.</p> : null}
          {labelReading ? (
            <p className={styles.small}>
              Read from your label:{' '}
              {[
                labelReading.name,
                labelReading.proof != null ? `${labelReading.proof} proof` : null,
                labelReading.batch ? `batch ${labelReading.batch}` : null,
                labelReading.barrel ? `barrel ${labelReading.barrel}` : null,
                labelReading.storePick ? `${labelReading.storePick} pick` : null,
                labelReading.ageStatement,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          ) : null}
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
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
          {labelPhoto && gtin13 ? (
            <Button
              variant="ghost"
              onClick={() => void resizeImageFile(labelPhoto, 1600).then((jpeg) => downloadBlob(jpeg, `${gtin13}-label.jpg`))}
            >
              Save label photo for the AI label test
            </Button>
          ) : null}
          {axe?.sources.length || labelScan?.axe.sources.length ? (
            <ul className={styles.sources} aria-label="AXE sources">
              {[...(axe?.sources ?? []), ...(labelScan?.axe.sources ?? [])].map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {draft ? (
        <section className={styles.card}>
          <h2 className={styles.heading}>3. Check the details</h2>
          <p className={styles.small}>
            {selected ? `From: ${selected.trust === 'verified' ? 'FIP’s verified catalog' : selected.trust === 'yours' ? 'what you saved before' : 'an AXE suggestion — not verified'}.` : 'Entered by you.'}{' '}
            Batch, barrel and proof come only from FIP’s verified catalog or your own label.
          </p>
          <BarcodeBottleForm draft={draft} onChange={setDraft} />
          <h3 className={styles.subheading}>4. Add it</h3>
          <BarcodeSaveActions
            matches={matches}
            canSave={Boolean(user) && Boolean(draft.values.name.trim())}
            busy={busy === 'save'}
            submitForReview={submitForReview}
            onSubmitForReviewChange={setSubmitForReview}
            onAdd={addNew}
            onIncrease={increase}
          />
          {!user ? <p className={styles.small}>Sign in to save.</p> : null}
          {saveStatus ? <output className={styles.small}>{saveStatus}</output> : null}
        </section>
      ) : null}

      <section className={styles.card}>
        <h2 className={styles.heading}>Test sample ({samples.length} of 30)</h2>
        <p className={styles.small}>
          After each scan, write down what the bottle in your hand actually is. That ground truth is what Claude and Gemini are
          graded against. Include standard releases, barrel-proof batches, single barrels and store picks.
        </p>
        <div className={styles.form}>
          <Field label="Actual bottle (from the label)" htmlFor="poc-expected-name">
            <input id="poc-expected-name" className={controlClassName} value={expectedName} onChange={(e) => setExpectedName(e.target.value)} />
          </Field>
          <Field label="Actual distillery" htmlFor="poc-expected-distillery">
            <input id="poc-expected-distillery" className={controlClassName} value={expectedDistillery} onChange={(e) => setExpectedDistillery(e.target.value)} />
          </Field>
          <Field label="Proof on the label (if printed)" htmlFor="poc-expected-proof">
            <input id="poc-expected-proof" className={controlClassName} inputMode="decimal" value={expectedProof} onChange={(e) => setExpectedProof(e.target.value)} />
          </Field>
          <Field label="Batch or barrel on the label (if printed)" htmlFor="poc-expected-batch">
            <input id="poc-expected-batch" className={controlClassName} value={expectedBatch} onChange={(e) => setExpectedBatch(e.target.value)} />
          </Field>
          <Field label="Kind" htmlFor="poc-variant">
            <select id="poc-variant" className={controlClassName} value={variantKind} onChange={(e) => setVariantKind(e.target.value as VariantKind)}>
              {Object.entries(VARIANT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className={styles.actions}>
          <Button onClick={recordSample} disabled={!decoded || !expectedName.trim()}>Record this scan</Button>
          <Button variant="secondary" onClick={exportCsv} disabled={samples.length === 0}>Export CSV</Button>
          <Button variant="danger" onClick={clearSamples} disabled={samples.length === 0}>Clear</Button>
        </div>
        {samples.length > 0 ? (
          <ol className={styles.samples}>
            {samples.map((s) => (
              <li key={`${s.at}-${s.gtin13}`}>
                {s.expectedName} · {s.gtin13} · {VARIANT_LABELS[s.variantKind]} · {s.mode}
                {s.msToDecode !== '' ? ` · ${s.msToDecode} ms` : ''}
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </div>
  )
}
