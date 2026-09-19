import { Modal } from '../../components/ui/Modal'
import { MORE_FILTERS, type Filter } from './collectionFilters'
import styles from './CollectionFilterSheet.module.css'

interface CollectionFilterSheetProps {
  active: Filter
  counts: Record<Filter, number>
  onSelect: (filter: Filter) => void
  onClose: () => void
}

// Everything past the header summary's five quick tiles — Favorites,
// Wishlist, Incoming, Core Bar, and every new inventory-intelligence view —
// lives here instead of as more permanent buttons on the page itself (see
// the batch's own "do not display every filter as a large permanent
// button"). One tap picks a view and closes the sheet.
export function CollectionFilterSheet({ active, counts, onSelect, onClose }: CollectionFilterSheetProps) {
  return (
    <Modal title="More Filters" onClose={onClose}>
      <div className={styles.list}>
        {MORE_FILTERS.map((meta) => {
          const isActive = active === meta.value
          return (
            <button
              key={meta.value}
              type="button"
              className={isActive ? `${styles.option} ${styles.optionActive}` : styles.option}
              aria-pressed={isActive}
              onClick={() => {
                onSelect(meta.value)
                onClose()
              }}
            >
              <span className={styles.optionMain}>
                <span className={styles.optionLabel}>{meta.label}</span>
                <span className={styles.optionDescription}>{meta.description}</span>
              </span>
              <span className={styles.optionCount}>{counts[meta.value]}</span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
