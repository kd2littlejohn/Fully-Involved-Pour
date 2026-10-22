import { Button } from '../../components/ui/Button'
import type { Bottle } from '../../data/types'
import type { BarMatches } from './inventory'
import styles from './Barcode.module.css'

// Where the picked bottle goes. When the same release is already in the
// user's bar, Increase Quantity comes first instead of a duplicate; a
// wishlist copy can move to My Bar. Other releases sharing the barcode are
// mentioned but never treated as duplicates.

function quantityOf(bottle: Bottle): number {
  return bottle.instances?.length || bottle.quantity || 1
}

interface BarcodeSaveActionsProps {
  matches: BarMatches
  canSave: boolean
  busy: boolean
  submitForReview: boolean
  onSubmitForReviewChange: (value: boolean) => void
  onAdd: (status: 'sealed' | 'wishlist') => void
  onIncrease: (bottle: Bottle) => void
}

export function BarcodeSaveActions({
  matches,
  canSave,
  busy,
  submitForReview,
  onSubmitForReviewChange,
  onAdd,
  onIncrease,
}: BarcodeSaveActionsProps) {
  const existing = matches.sameRelease
  return (
    <div className={styles.stack}>
      {existing.map((bottle) => (
        <div key={bottle.id} className={styles.notice}>
          <p>
            <strong>{bottle.name}</strong>{' '}
            {bottle.status === 'wishlist' ? 'is on your Wishlist.' : `is already in My Bar (${quantityOf(bottle)}).`}
          </p>
          <Button onClick={() => onIncrease(bottle)} disabled={busy || !canSave}>
            {bottle.status === 'wishlist' ? 'Move to My Bar' : 'Increase quantity'}
          </Button>
        </div>
      ))}
      {matches.sameBarcode.length > 0 ? (
        <p className={styles.muted}>
          Also in your bar with this barcode: {matches.sameBarcode.map((b) => b.name).join(', ')}.
        </p>
      ) : null}
      <div className={styles.actions}>
        <Button variant={existing.length ? 'secondary' : 'primary'} onClick={() => onAdd('sealed')} disabled={busy || !canSave}>
          {existing.length ? 'Add as a separate bottle' : 'Add to My Bar'}
        </Button>
        <Button variant="secondary" onClick={() => onAdd('wishlist')} disabled={busy || !canSave}>
          Add to Wishlist
        </Button>
      </div>
      <label className={styles.checkbox}>
        <input type="checkbox" checked={submitForReview} onChange={(e) => onSubmitForReviewChange(e.target.checked)} />
        Suggest this bottle for FIP's shared catalog. It stays private until FIP checks it.
      </label>
    </div>
  )
}
