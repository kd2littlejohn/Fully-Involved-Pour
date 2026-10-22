import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Field, controlClassName } from '../../components/ui/Field'
import { PageHeader } from '../../components/layout/PageHeader'
import { useAuth } from '../../hooks/useAuth'
import {
  lookupBarcode,
  saveBarcodeConfirmation,
  type BarcodeBottle,
  type BarcodeLookupResult,
  type ConfirmationOrigin,
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
import { resizeImageFile } from '../../features/ai/imageToBase64'
import styles from './BarcodePocPage.module.css'

// Scan Barcode — Phase 0 proof of concept. Dev builds only (see router.tsx):
// never part of the production app, and never linked from Add Bottle.
//
// What it's for (docs/BARCODE_POC.md):
//  1. Camera/decoder test on real phones: decode rate, time to decode,
//     misreads, iPhone Safari vs Android Chrome, native vs ZXing.
//  2. Recording ground truth — what each scanned bottle actually is — and
//     exporting the sample CSV that scripts/barcodePoc.mjs runs through
//     Claude and Gemini.
//  3. Trying the confirm/correct flow end to end against the emulators.

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
  expectedName: string
  expectedDistillery: string
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

const EMPTY_FORM = { name: '', distillery: '', expression: '', proof: '', sizeMl: '' }

function show(value: string | number | null | undefined, suffix = ''): string {
  return value === null || value === undefined || value === '' ? 'Not found' : `${value}${suffix}`
}

export function BarcodePocPage() {
  const { user } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<LiveScanner | null>(null)

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
  const [lookupMs, setLookupMs] = useState<number | null>(null)
  const [lookupBusy, setLookupBusy] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)

  const [expectedName, setExpectedName] = useState('')
  const [expectedDistillery, setExpectedDistillery] = useState('')
  const [variantKind, setVariantKind] = useState<VariantKind>('standard')
  const [samples, setSamples] = useState<SampleRow[]>(readSamples)

  useEffect(() => {
    void hasNativeDetector().then(setNativeAvailable)
    return () => scannerRef.current?.stop()
  }, [])

  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.url) : undefined), [photo])

  function resetResult() {
    setDecoded(null)
    setStats(null)
    setLookup(null)
    setLookupMs(null)
    setLookupError(null)
    setSaveStatus(null)
    setForm(EMPTY_FORM)
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
          setDecoded(result)
          setStats({ ...scanner.stats })
          setScanning(false)
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
    if (result) setDecoded(result)
    else setScanError('No valid UPC-A, UPC-E or EAN-13 found in that photo.')
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
    setDecoded({ raw: typed, format: normalized.symbology, engine: 'zxing', normalized, msToDecode: 0 })
  }

  async function runLookup(skipAi: boolean) {
    if (!decoded) return
    setLookupBusy(true)
    setLookupError(null)
    setSaveStatus(null)
    const started = performance.now()
    try {
      const result = await lookupBarcode(decoded.normalized.gtin13, { skipAi })
      setLookupMs(Math.round(performance.now() - started))
      setLookup(result)
      const b: Partial<BarcodeBottle> = result.bottle ?? {}
      setForm({
        name: b.name ?? '',
        distillery: b.distillery ?? '',
        expression: b.expression ?? '',
        proof: b.proof != null ? String(b.proof) : '',
        sizeMl: b.sizeMl != null ? String(b.sizeMl) : '',
      })
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Lookup failed.')
    } finally {
      setLookupBusy(false)
    }
  }

  async function confirm() {
    if (!user || !decoded || !form.name.trim()) return
    const b = lookup?.bottle
    const edited =
      !b ||
      form.name.trim() !== (b.name ?? '') ||
      form.distillery.trim() !== (b.distillery ?? '') ||
      form.expression.trim() !== (b.expression ?? '') ||
      form.proof !== (b.proof != null ? String(b.proof) : '') ||
      form.sizeMl !== (b.sizeMl != null ? String(b.sizeMl) : '')
    const origin: ConfirmationOrigin = edited
      ? 'manual'
      : lookup?.source === 'verified'
        ? 'verified'
        : 'ai-claude'
    try {
      await saveBarcodeConfirmation(
        user.uid,
        decoded.normalized.gtin13,
        {
          name: form.name.trim(),
          distillery: form.distillery.trim() || null,
          brand: b?.brand ?? null,
          expression: form.expression.trim() || null,
          category: b?.category ?? null,
          sizeMl: form.sizeMl ? Number(form.sizeMl) : null,
          proof: form.proof ? Number(form.proof) : null,
          proofVaries: b?.proofVaries ?? false,
          ageStatement: b?.ageStatement ?? null,
          upcSharedAcrossVariants: b?.upcSharedAcrossVariants ?? false,
        },
        origin,
      )
      setSaveStatus(`Saved as your confirmation (${origin}). Only your own scans will use it.`)
    } catch (err) {
      setSaveStatus(err instanceof Error ? `Not saved: ${err.message}` : 'Not saved.')
    }
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
      expectedName: expectedName.trim(),
      expectedDistillery: expectedDistillery.trim(),
      variantKind,
      device: navigator.userAgent,
    }
    const next = [...samples, row]
    setSamples(next)
    writeSamples(next)
    setExpectedName('')
    setExpectedDistillery('')
    setVariantKind('standard')
  }

  function exportCsv() {
    const header = [
      'gtin13', 'upc_a', 'symbology', 'expected_name', 'expected_distillery', 'variant_kind', 'photo_file',
      'mode', 'engine', 'ms_to_camera', 'ms_to_decode', 'rejected_reads', 'device', 'recorded_at',
    ]
    const lines = samples.map((s) =>
      [
        s.gtin13, s.upcA, s.symbology, s.expectedName, s.expectedDistillery, s.variantKind, `${s.gtin13}.jpg`,
        s.mode, s.engine, s.msToCamera, s.msToDecode, s.rejectedReads, s.device, s.at,
      ].map(csvCell).join(','),
    )
    downloadBlob(new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' }), 'barcode-poc-sample.csv')
  }

  function clearSamples() {
    if (!window.confirm(`Delete all ${samples.length} recorded samples on this device?`)) return
    setSamples([])
    writeSamples([])
  }

  const bottle = lookup?.bottle

  return (
    <div className={styles.page}>
      <PageHeader
        eyebrow="Development only"
        title="Barcode PoC"
        subtitle="Decode locally, look up, confirm, and record ground truth for the Phase 0 test."
      />

      <section className={styles.card}>
        <h2 className={styles.heading}>This device</h2>
        <dl className={styles.facts}>
          <dt>Secure context (camera allowed)</dt>
          <dd>{window.isSecureContext ? 'Yes' : 'No — camera needs HTTPS'}</dd>
          <dt>Built-in barcode detector</dt>
          <dd>{nativeAvailable === null ? 'Checking…' : nativeAvailable ? 'Yes (UPC-A, UPC-E, EAN-13)' : 'No — ZXing will be used'}</dd>
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
        <h2 className={styles.heading}>Scan</h2>
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
        {photo && decoded ? (
          <Button
            variant="ghost"
            onClick={() => void resizeImageFile(photo.file, 1600).then((jpeg) => downloadBlob(jpeg, `${decoded.normalized.gtin13}.jpg`))}
          >
            Save photo for the AI photo test
          </Button>
        ) : null}
      </section>

      {decoded ? (
        <section className={styles.card}>
          <h2 className={styles.heading}>Look up</h2>
          <p className={styles.small}>
            Checks verified mappings, then your own confirmations. &ldquo;With AI&rdquo; then asks Claude + web search (needs the
            functions emulator with an Anthropic key, or a deployed function).
          </p>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => void runLookup(true)} disabled={lookupBusy}>Catalog only</Button>
            <Button onClick={() => void runLookup(false)} disabled={lookupBusy}>{lookupBusy ? 'Looking up…' : 'Look up with AI'}</Button>
          </div>
          {lookupError ? <p className={styles.error} role="alert">{lookupError}</p> : null}
          {lookup ? (
            <>
              <p className={styles.badge}>
                Source: {lookup.source}
                {lookupMs != null ? ` · ${lookupMs} ms round trip` : ''}
                {lookup.model ? ` · ${lookup.model}` : ''}
              </p>
              <div className={styles.confirm}>
                <div className={styles.image}>
                  {photo ? <img src={photo.url} alt="The bottle you scanned" /> : <span>No image</span>}
                </div>
                <dl className={styles.facts}>
                  <dt>Bottle name</dt>
                  <dd>{show(bottle?.name)}</dd>
                  <dt>Distillery</dt>
                  <dd>{show(bottle?.distillery)}</dd>
                  <dt>Expression</dt>
                  <dd>{show(bottle?.expression)}</dd>
                  <dt>Proof</dt>
                  <dd>{bottle?.proofVaries || bottle?.upcSharedAcrossVariants ? 'Varies by batch or barrel — check your label' : show(bottle?.proof)}</dd>
                  <dt>Size</dt>
                  <dd>{show(bottle?.sizeMl, ' ml')}</dd>
                </dl>
              </div>
              {bottle?.upcSharedAcrossVariants ? (
                <p className={styles.small}>This barcode is shared by several releases (batches, single barrels or store picks).</p>
              ) : null}
              {bottle?.sources?.length ? (
                <ul className={styles.sources}>
                  {bottle.sources.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a>
                    </li>
                  ))}
                </ul>
              ) : null}
              <h3 className={styles.subheading}>Confirm or correct</h3>
              <div className={styles.form}>
                <Field label="Bottle name" htmlFor="poc-name" required>
                  <input id="poc-name" className={controlClassName} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field label="Distillery" htmlFor="poc-distillery">
                  <input id="poc-distillery" className={controlClassName} value={form.distillery} onChange={(e) => setForm({ ...form, distillery: e.target.value })} />
                </Field>
                <Field label="Expression" htmlFor="poc-expression">
                  <input id="poc-expression" className={controlClassName} value={form.expression} onChange={(e) => setForm({ ...form, expression: e.target.value })} />
                </Field>
                <Field label="Proof (fixed-proof products only)" htmlFor="poc-proof">
                  <input id="poc-proof" className={controlClassName} inputMode="decimal" value={form.proof} onChange={(e) => setForm({ ...form, proof: e.target.value })} />
                </Field>
                <Field label="Size (ml)" htmlFor="poc-size">
                  <input id="poc-size" className={controlClassName} inputMode="numeric" value={form.sizeMl} onChange={(e) => setForm({ ...form, sizeMl: e.target.value })} />
                </Field>
              </div>
              <Button onClick={() => void confirm()} disabled={!user || !form.name.trim()}>
                {user ? 'Confirm for my scans' : 'Sign in to confirm'}
              </Button>
              {saveStatus ? <output className={styles.small}>{saveStatus}</output> : null}
            </>
          ) : null}
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
