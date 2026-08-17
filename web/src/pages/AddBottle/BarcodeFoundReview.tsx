import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import type { BarcodeLookupResult } from '../../data/repositories/barcode'
import styles from './BarcodeFoundReview.module.css'

interface BarcodeFoundReviewProps {
  result: BarcodeLookupResult
  // Name of a bottle already in this user's own bar with the same UPC, if
  // any — surfaced as a note, never blocks adding a second one (a person
  // can legitimately own two bottles of the same release).
  alreadyOwnedName?: string
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{value}</dd>
    </div>
  )
}

export function BarcodeFoundReview({ result, alreadyOwnedName }: BarcodeFoundReviewProps) {
  return (
    <div className={styles.wrap}>
      <p className={styles.eyebrow}>Found Bottle</p>

      <div className={styles.imageFrame}>
        {result.imageUrl ? (
          <img className={styles.image} src={result.imageUrl} alt="" />
        ) : (
          <BottlePlaceholder name={result.name} />
        )}
      </div>

      <h1 className={styles.name}>{result.name || 'Unknown Bottle'}</h1>

      {alreadyOwnedName ? (
        <p className={styles.ownedNote}>Already in My Bar as “{alreadyOwnedName}.”</p>
      ) : null}

      <dl className={styles.details}>
        {result.distillery ? <DetailRow label="Distillery" value={result.distillery} /> : null}
        {result.type ? <DetailRow label="Whiskey Type" value={result.type} /> : null}
        {result.proof ? <DetailRow label="Proof" value={String(result.proof)} /> : null}
        {result.ageStatement ? <DetailRow label="Age" value={result.ageStatement} /> : null}
        <DetailRow label="UPC" value={result.upc} />
      </dl>
    </div>
  )
}
