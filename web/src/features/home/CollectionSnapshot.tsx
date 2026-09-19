import { Link } from 'react-router-dom'
import type { CollectionSnapshot as CollectionSnapshotData } from './selectors'
import styles from './CollectionSnapshot.module.css'

interface CollectionSnapshotProps {
  snapshot: CollectionSnapshotData
}

export function CollectionSnapshot({ snapshot }: CollectionSnapshotProps) {
  const { total, open, sealed, needingAttention } = snapshot

  return (
    <Link to="/collection" className={styles.card}>
      <div className={styles.stat}>
        <div className={styles.value}>{total}</div>
        <div className={styles.label}>Total</div>
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
        <div className={styles.label}>Needs Attention</div>
      </div>
    </Link>
  )
}
