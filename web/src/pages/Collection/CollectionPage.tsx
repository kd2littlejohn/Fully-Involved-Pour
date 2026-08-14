import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { controlClassName } from '../../components/ui/Field'
import { BottleCard } from '../../components/domain/BottleCard'
import { BottleListRow } from '../../components/domain/BottleListRow'
import { SignInButton } from '../../components/domain/SignInButton'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { getCoreBarBottles } from '../../features/coreBar/selectors'
import { InfinityBottleButton } from '../../features/infinityBottle/InfinityBottleButton'
import { sortBottles, SORT_OPTIONS, type SortOption } from '../../features/collection/sortBottles'
import type { Bottle } from '../../data/types'
import styles from './CollectionPage.module.css'

type Filter = 'all' | 'open' | 'sealed' | 'wishlist' | 'incoming' | 'favorites' | 'core-bar'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Opened' },
  { value: 'sealed', label: 'Sealed' },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'incoming', label: 'Incoming' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'core-bar', label: 'Core Bar' },
]

function matchesFilter(bottle: Bottle, filter: Filter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'favorites':
      return Boolean(bottle.favorite)
    case 'core-bar':
      return false // Core Bar is computed from pours, handled separately below.
    default:
      return bottle.status === filter
  }
}

function matchesQuery(bottle: Bottle, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return bottle.name.toLowerCase().includes(q) || (bottle.distillery?.toLowerCase().includes(q) ?? false)
}

export function CollectionPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { userDoc, loading: dataLoading, deleteBottles } = useUserData()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortOption>('recent')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const coreBarBottles = useMemo(() => getCoreBarBottles(userDoc.bottles, userDoc.pours), [userDoc.bottles, userDoc.pours])

  const filteredBottles = useMemo(() => {
    const base = filter === 'core-bar' ? coreBarBottles : userDoc.bottles.filter((bottle) => matchesFilter(bottle, filter))
    return base.filter((bottle) => matchesQuery(bottle, query))
  }, [userDoc.bottles, filter, coreBarBottles, query])

  const sortedBottles = useMemo(() => sortBottles(filteredBottles, sort), [filteredBottles, sort])

  function countForFilter(value: Filter): number {
    const base = value === 'core-bar' ? coreBarBottles : userDoc.bottles.filter((b) => matchesFilter(b, value))
    return base.filter((bottle) => matchesQuery(bottle, query)).length
  }

  const allFilteredSelected = filteredBottles.length > 0 && filteredBottles.every((b) => selectedIds.has(b.id))

  function exitSelectMode() {
    setSelectMode(false)
    setSelectedIds(new Set())
    setConfirmingBulkDelete(false)
  }

  function toggleSelected(bottleId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(bottleId)) next.delete(bottleId)
      else next.add(bottleId)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds(allFilteredSelected ? new Set() : new Set(filteredBottles.map((b) => b.id)))
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    await deleteBottles(Array.from(selectedIds))
    setBulkDeleting(false)
    exitSelectMode()
  }

  if (authLoading || dataLoading) {
    return <PageHeader eyebrow="My Bar" title="Your bottles." />
  }

  if (!user) {
    return (
      <>
        <PageHeader eyebrow="My Bar" title="Your bottles." subtitle="Manage and explore the bottles you own." />
        <EmptyState
          title="Your whiskey journey starts here."
          message="Sign in to start building your bar."
          action={<SignInButton />}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader eyebrow="My Bar" title="Your bottles." subtitle="Manage and explore the bottles you own." />

      {userDoc.bottles.length === 0 ? (
        <EmptyState
          title="Your whiskey journey starts here."
          message="Add a bottle to begin building your bar."
          action={<Button onClick={() => navigate('/bottles/new')}>Add a Bottle</Button>}
        />
      ) : (
        <>
          <div className={styles.searchRow}>
            <input
              type="search"
              className={controlClassName}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or distillery…"
              aria-label="Search your bar"
            />
          </div>

          <div className={styles.toolbar}>
            <div className={styles.chips}>
              {FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={option.value === filter ? `${styles.chip} ${styles.chipActive}` : styles.chip}
                  onClick={() => setFilter(option.value)}
                  aria-pressed={option.value === filter}
                >
                  {option.label} ({countForFilter(option.value)})
                </button>
              ))}
            </div>
            <div className={styles.toolbarActions}>
              <select
                className={styles.sortSelect}
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                aria-label="Sort bottles"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className={styles.viewToggle} role="group" aria-label="View as">
                <button
                  type="button"
                  className={viewMode === 'grid' ? `${styles.viewButton} ${styles.viewButtonActive}` : styles.viewButton}
                  onClick={() => setViewMode('grid')}
                  aria-pressed={viewMode === 'grid'}
                  aria-label="Grid view"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={viewMode === 'list' ? `${styles.viewButton} ${styles.viewButtonActive}` : styles.viewButton}
                  onClick={() => setViewMode('list')}
                  aria-pressed={viewMode === 'list'}
                  aria-label="List view"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="18" x2="20" y2="18" />
                  </svg>
                </button>
              </div>
              {selectMode ? (
                <Button variant="ghost" onClick={exitSelectMode}>
                  Cancel
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => setSelectMode(true)}>
                  Select
                </Button>
              )}
              <InfinityBottleButton />
              <Button onClick={() => navigate('/bottles/new')}>Add a Bottle</Button>
            </div>
          </div>

          {selectMode ? (
            <div className={styles.selectBar}>
              {confirmingBulkDelete ? (
                <div className={styles.confirm}>
                  <span className={styles.confirmText}>
                    Delete {selectedIds.size} {selectedIds.size === 1 ? 'bottle' : 'bottles'}?
                  </span>
                  <Button variant="ghost" onClick={() => setConfirmingBulkDelete(false)} disabled={bulkDeleting}>
                    Cancel
                  </Button>
                  <Button variant="secondary" onClick={handleBulkDelete} disabled={bulkDeleting}>
                    {bulkDeleting ? 'Deleting…' : 'Confirm Delete'}
                  </Button>
                </div>
              ) : (
                <>
                  <Button variant="ghost" onClick={toggleSelectAll}>
                    {allFilteredSelected ? 'Deselect All' : 'Select All'}
                  </Button>
                  <span className={styles.selectCount}>{selectedIds.size} selected</span>
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmingBulkDelete(true)}
                    disabled={selectedIds.size === 0}
                  >
                    Delete Selected
                  </Button>
                </>
              )}
            </div>
          ) : null}

          {sortedBottles.length === 0 ? (
            <EmptyState
              title={query.trim() ? `No bottles match "${query.trim()}".` : filter === 'core-bar' ? 'No Core Bar bottles yet.' : 'No bottles here yet.'}
              message={
                query.trim()
                  ? 'Try a different name or distillery, or clear the search.'
                  : filter === 'core-bar'
                    ? 'Log a few Pour Stories for a bottle to see it earn a permanent spot here.'
                    : 'Try a different filter, or add a bottle to this view.'
              }
            />
          ) : viewMode === 'grid' ? (
            <div className={styles.grid}>
              {sortedBottles.map((bottle) => (
                <BottleCard
                  key={bottle.id}
                  bottle={bottle}
                  selectable={selectMode}
                  selected={selectedIds.has(bottle.id)}
                  onToggleSelect={() => toggleSelected(bottle.id)}
                />
              ))}
            </div>
          ) : (
            <div className={styles.list}>
              {sortedBottles.map((bottle) => (
                <BottleListRow
                  key={bottle.id}
                  bottle={bottle}
                  selectable={selectMode}
                  selected={selectedIds.has(bottle.id)}
                  onToggleSelect={() => toggleSelected(bottle.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
