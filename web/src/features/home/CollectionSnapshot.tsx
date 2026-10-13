import { Link } from 'react-router-dom'
import type { CollectionSnapshot as CollectionSnapshotData } from './selectors'
import styles from './CollectionSnapshot.module.css'

interface CollectionSnapshotProps {
  snapshot: CollectionSnapshotData
}

export function CollectionSnapshot({ snapshot }: CollectionSnapshotProps) {
  const { inBar, open, sealed, needingAttention } = snapshot

  return (
    <Link to="/collection" className={styles.card} aria-label={`Your bar: ${inBar} bottles, ${open} open, ${sealed} sealed, ${needingAttention} low or empty`}>
      <div className={styles.stat}>
        <div className={styles.value}>{inBar}</div>
        <div className={styles.label}>In Your Bar</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.value}>{open}</div>
        <div className={styles.label}>Open</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.value}>{sealed}</div>
        <div className={styles.label}>Sealed</div>
      </div>
      <div className={styles.stat}>
        <div className={needingAttention > 0 ? `${styles.value} ${styles.valueAttention}` : styles.value}>{needingAttention}</div>
        <div className={styles.label}>Low or Empty</div>
      </div>
    </Link>
  )
}
