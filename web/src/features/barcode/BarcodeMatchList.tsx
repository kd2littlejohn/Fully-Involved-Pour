import { Button } from '../../components/ui/Button'
import { RELEASE_KIND_LABELS, TRUST_LABELS, type BarcodeOption } from './options'
import { GoogleSearchSuggestions } from './GoogleSearchSuggestions'
import styles from './Barcode.module.css'

// The bottles a scanned barcode could be. Several releases often share one
// barcode, so the user always picks; every row says how far it can be
// trusted. Used by Scan Barcode on Add Bottle (ScanBarcodeFlow) and the
// dev diagnostics page.

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function detail(option: BarcodeOption): string {
  const b = option.bottle
  const parts = [
    b.releaseKind ? RELEASE_KIND_LABELS[b.releaseKind] : null,
    b.distillery,
    b.sizeMl ? `${b.sizeMl} ml` : null,
    b.proof != null ? `${b.proof} proof` : b.proofVaries ? 'Proof varies' : null,
    b.ageStatement,
    b.batch ? `Batch ${b.batch}` : null,
    b.barrel ? `Barrel ${b.barrel}` : null,
    b.storePick ? `${b.storePick} pick` : null,
  ]
  return parts.filter(Boolean).join(' · ')
}

interface BarcodeMatchListProps {
  options: BarcodeOption[]
  selectedKey: string | null
  /** Option keys whose release is already in the user's bar or wishlist. */
  inBarKeys?: ReadonlySet<string>
  onSelect: (option: BarcodeOption) => void
  /** Google's Search Suggestions HTML, shown under Google's suggestions. */
  googleSearchEntryPoint?: string | null
  onAskAxe?: () => void
  askAxeBusy?: boolean
  /** Omit to hide Scan Front Label with AXE (e.g. when signed out). */
  onScanLabel?: () => void
  scanLabelBusy?: boolean
  onManual: () => void
  /** Shown instead of the default when the list is empty. */
  emptyText?: string
}

export function BarcodeMatchList({
  options,
  selectedKey,
  inBarKeys,
  onSelect,
  googleSearchEntryPoint,
  onAskAxe,
  askAxeBusy,
  onScanLabel,
  scanLabelBusy,
  onManual,
  emptyText = "No match in FIP's catalog yet.",
}: BarcodeMatchListProps) {
  return (
    <div className={styles.stack}>
      {options.length === 0 ? (
        <p className={styles.muted}>{emptyText}</p>
      ) : (
        <>
          <p className={styles.muted}>
            {options.length === 1 ? 'Is this your bottle?' : `This barcode can be ${options.length} different bottles. Pick yours.`}
          </p>
          <ul className={styles.options} aria-label="Matching bottles">
            {options.map((option) => (
              <li key={option.key}>
                <button
                  type="button"
                  className={styles.option}
                  aria-pressed={selectedKey === option.key}
                  onClick={() => onSelect(option)}
                >
                  <span className={styles.optionName}>{option.bottle.name}</span>
                  <span className={styles.optionDetail}>{detail(option)}</span>
                  <span className={styles.tags}>
                    <span className={styles.tag} data-trust={option.trust}>
                      {TRUST_LABELS[option.trust]}
                    </span>
                    {option.savedByYou && option.trust === 'verified' ? <span className={styles.tag}>You saved this before</span> : null}
                    {inBarKeys?.has(option.key) ? <span className={styles.tag}>In your bar</span> : null}
                  </span>
                  {option.notes ? <span className={styles.optionDetail}>{option.notes}</span> : null}
                </button>
                {(option.trust === 'axe' || option.trust === 'google') && option.sources.length > 0 ? (
                  <p className={styles.sources}>
                    Sources:{' '}
                    {option.sources.map((source, i) => (
                      <span key={source.url}>
                        {i > 0 ? ', ' : ''}
                        <a href={source.url} target="_blank" rel="noreferrer">
                          {source.title || hostname(source.url)}
                        </a>
                      </span>
                    ))}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          {googleSearchEntryPoint && options.some((o) => o.trust === 'google') ? (
            <div className={styles.stack}>
              <p className={styles.muted}>Google suggestions come from Google Search. Check them against your label.</p>
              <GoogleSearchSuggestions html={googleSearchEntryPoint} />
            </div>
          ) : null}
        </>
      )}
      <div className={styles.alternatives}>
        <p className={styles.muted}>{options.length === 0 ? 'Identify it another way:' : 'Not listed?'}</p>
        <div className={styles.actions}>
          {onAskAxe ? (
            <Button variant="secondary" onClick={onAskAxe} disabled={askAxeBusy}>
              {askAxeBusy ? 'Asking AXE…' : 'Ask AXE about this barcode'}
            </Button>
          ) : null}
          {onScanLabel ? (
            <Button variant="secondary" onClick={onScanLabel} disabled={scanLabelBusy}>
              {scanLabelBusy ? 'Reading label…' : 'Scan Front Label with AXE'}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onManual}>
            Enter details manually
          </Button>
        </div>
      </div>
    </div>
  )
}
