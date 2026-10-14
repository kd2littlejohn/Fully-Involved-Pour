import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
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
import { bottleDistilleryMatches } from '../../data/distillery/search'
import { detectPickFlags } from '../../data/repositories/rarity'
import { RarityDonutChart } from '../../components/ui/RarityDonutChart'
import { rarityBreakdown } from '../../features/rarity/rarityBreakdown'
import { matchesRarityFilter, type RarityFilterValue } from '../../features/rarity/rarityFilter'
import { selectRarityReviewQueue } from '../../features/rarity/rarityReviewQueue'
import { RARITY_LABEL, UNCLASSIFIED_LABEL } from '../../features/rarity/rarityLevels'
import { CollectionSummaryBar } from '../../features/collection/CollectionSummaryBar'
import { CollectionOverview } from '../../features/collection/CollectionOverview'
import { MyBarHero } from '../../features/collection/MyBarHero'
import { LegacyBottleCard } from '../../features/collection/LegacyBottleCard'
import { QuickFilterChips } from '../../features/collection/QuickFilterChips'
import { CollectionFilterSheet } from '../../features/collection/CollectionFilterSheet'
import { matchesFilter, filterLabel, ALL_FILTERS, type Filter } from '../../features/collection/collectionFilters'
import { getInfinityIngredientBottleIds } from '../../features/collection/inventoryFilters'
import {
  initialInventoryView,
  inventorySearchString,
  parseInventoryView,
  useInventoryScrollRestoration,
  writeSavedInventory,
} from '../../features/collection/inventoryViewState'
import type { Bottle } from '../../data/types'
import { AxeInlineSuggestion } from '../../features/sommelier/AxeInlineSuggestion'
import styles from './CollectionPage.module.css'

// Rarity levels the quick chips cover; any other rarity picked on the chart
// keeps the chart open so its selection stays visible.
const QUICK_RARITIES = new Set<RarityFilterValue>(['rare', 'uncommon'])

function matchesQuery(bottle: Bottle, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (
    bottle.name.toLowerCase().includes(q) ||
    (bottle.distillery?.toLowerCase().includes(q) ?? false) ||
    (bottle.type?.toLowerCase().includes(q) ?? false) ||
    (bottle.proof !== undefined && String(bottle.proof).includes(q))
  ) {
    return true
  }
  // Catches e.g. "MGP" finding a bottle stored under "Ross & Squibb
  // Distillery", or "BT" finding one stored under "Buffalo Trace" — see
  // data/distillery/search.ts.
  if (bottleDistilleryMatches(bottle.distillery, q)) return true
  // "store pick" / "single barrel" reuse the same name-based detection the
  // rarity suggestion prompt already relies on (see data/repositories/
  // rarity.ts) rather than a new persisted field.
  const flags = detectPickFlags(bottle.name)
  if (flags.storePick && 'store pick'.includes(q)) return true
  if (flags.singleBarrel && 'single barrel'.includes(q)) return true
  return false
}

export function CollectionPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { userDoc, loading: dataLoading, deleteBottles } = useUserData()
  const [, setSearchParams] = useSearchParams()
  const location = useLocation()
  // Search, filters, sort and view mode all live in the URL and a per-tab
  // session copy (features/collection/inventoryViewState.ts), so opening a
  // bottle and coming back, via Back, "Back to My Bar" or the nav,
  // restores the exact list. Explicit URL params (e.g. Home's ?filter=open
  // "View All" link) take precedence over the saved view.
  //
  // URL params apply immediately; the saved view needs the user's id, and
  // useAuth starts every mount as "loading", so restoring waits for it.
  // Until then nothing is written back, so the saved view is never
  // overwritten by the defaults.
  const [initial] = useState(() => parseInventoryView(new URLSearchParams(location.search)))
  const [filter, setFilter] = useState<Filter>(initial.filter)
  const [rarityFilter, setRarityFilter] = useState<RarityFilterValue>(initial.rarity)
  const [query, setQuery] = useState(initial.query)
  const [sort, setSort] = useState<SortOption>(initial.sort)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(initial.view)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (hydrated || authLoading) return
    const { view, restored } = initialInventoryView(location.search, user?.uid)
    if (restored) {
      setFilter(view.filter)
      setRarityFilter(view.rarity)
      setQuery(view.query)
      setSort(view.sort)
      setViewMode(view.view)
    }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, as soon as auth has resolved
  }, [authLoading])
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [showFilterSheet, setShowFilterSheet] = useState(false)

  // Mirrors the view into the URL (replacing, not pushing, so typing and
  // toggling don't pile up history entries) and into the session copy.
  const viewSearch = inventorySearchString({ query, filter, rarity: rarityFilter, sort, view: viewMode })
  useEffect(() => {
    if (!hydrated) return
    if (location.search !== viewSearch) setSearchParams(new URLSearchParams(viewSearch), { replace: true })
    writeSavedInventory(user?.uid, { search: viewSearch })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the view itself
  }, [hydrated, viewSearch, user?.uid])

  // Returns the user to where they were in the list (e.g. the bottle they
  // just opened). The list renders straight from cached user data, so
  // there's no refetch to wait for.
  useInventoryScrollRestoration(user?.uid, hydrated && Boolean(user) && !dataLoading, viewSearch)

  function clearFilters() {
    setFilter('all')
    setRarityFilter(null)
  }

  const coreBarBottles = useMemo(() => getCoreBarBottles(userDoc.bottles, userDoc.pours), [userDoc.bottles, userDoc.pours])
  const infinityIngredientIds = useMemo(() => getInfinityIngredientBottleIds(userDoc.infinityBottles), [userDoc.infinityBottles])

  const filteredBottles = useMemo(() => {
    const base = filter === 'core-bar' ? coreBarBottles : userDoc.bottles.filter((bottle) => matchesFilter(bottle, filter, userDoc.pours, infinityIngredientIds))
    return base.filter((bottle) => matchesQuery(bottle, query)).filter((bottle) => matchesRarityFilter(bottle, rarityFilter))
  }, [userDoc.bottles, userDoc.pours, filter, coreBarBottles, infinityIngredientIds, query, rarityFilter])

  const sortedBottles = useMemo(() => sortBottles(filteredBottles, sort, userDoc.pours), [filteredBottles, sort, userDoc.pours])

  function countForFilter(value: Filter): number {
    const base = value === 'core-bar' ? coreBarBottles : userDoc.bottles.filter((b) => matchesFilter(b, value, userDoc.pours, infinityIngredientIds))
    return base.filter((bottle) => matchesQuery(bottle, query)).filter((bottle) => matchesRarityFilter(bottle, rarityFilter)).length
  }

  const summary = useMemo(
    () => ({
      total: countForFilter('all'),
      open: countForFilter('open'),
      sealed: countForFilter('sealed'),
      finished: countForFilter('finished'),
      lowFill: countForFilter('low-fill'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- countForFilter closes over the same state already listed below
    [userDoc.bottles, userDoc.pours, infinityIngredientIds, query, rarityFilter],
  )

  const rarity = useMemo(() => rarityBreakdown(userDoc.bottles), [userDoc.bottles])
  const rarityReviewQueue = useMemo(() => selectRarityReviewQueue(userDoc.bottles), [userDoc.bottles])
  const hasActiveFilter = filter !== 'all' || rarityFilter !== null

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
    return <MyBarHero />
  }

  if (!user) {
    return (
      <>
        <MyBarHero subtitle="Manage and explore the bottles you own." />
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
      <MyBarHero subtitle="Manage and explore the bottles you own." />

      {userDoc.bottles.length === 0 ? (
        <EmptyState
          title="Your whiskey journey starts here."
          message="Add a bottle to begin building your bar."
          action={<Button onClick={() => navigate('/bottles/new')}>Add a Bottle</Button>}
        />
      ) : (
        <>
          <CollectionOverview summary={summary} defaultExpanded={rarityFilter !== null && !QUICK_RARITIES.has(rarityFilter)}>
            <RarityDonutChart rows={rarity.rows} total={rarity.total} selected={rarityFilter} onSelect={setRarityFilter} />
            <p className={styles.rarityDisclaimer}>
              Rarity reflects how hard a bottle is to find — availability, allocation, and release scarcity — never how good it tastes.
            </p>
            <CollectionSummaryBar summary={summary} active={filter} onSelect={setFilter} />
          </CollectionOverview>

          <LegacyBottleCard bottles={userDoc.bottles} />

          <div className={styles.searchRow}>
            <div className={styles.searchField}>
              <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                className={`${controlClassName} ${styles.searchInput}`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, distillery, type, or proof…"
                aria-label="Search your bar"
              />
            </div>
            <button type="button" className={styles.filterButton} onClick={() => setShowFilterSheet(true)} aria-label="More Filters">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <QuickFilterChips filter={filter} rarity={rarityFilter} onFilterChange={setFilter} onRarityChange={setRarityFilter} />

          {hasActiveFilter ? (
            <div className={styles.activeFilterPill}>
              <span>
                Filtering by{' '}
                {[filter !== 'all' ? filterLabel(filter) : null, rarityFilter ? (rarityFilter === 'unclassified' ? UNCLASSIFIED_LABEL : RARITY_LABEL[rarityFilter]) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <button type="button" className={styles.clearFiltersButton} onClick={clearFilters}>
                Clear Filters
              </button>
            </div>
          ) : null}

          {/* Two groups that wrap to fit: view, sort and selection; then
              the add / Infinity Bottle / rarity review / explore actions.
              Nothing scrolls sideways or gets cut off. */}
          <div className={styles.toolbar}>
            <div className={styles.toolGroup}>
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
              {selectMode ? (
                <Button variant="ghost" className={styles.toolButton} onClick={exitSelectMode}>
                  Cancel
                </Button>
              ) : (
                <Button variant="secondary" className={styles.toolButton} onClick={() => setSelectMode(true)}>
                  Select
                </Button>
              )}
            </div>
            <div className={styles.toolGroup}>
              <Button className={styles.toolButton} onClick={() => navigate('/bottles/new')}>
                Add a Bottle
              </Button>
              <InfinityBottleButton className={styles.toolButton} />
              {rarityReviewQueue.length > 0 ? (
                <Button variant="secondary" className={styles.toolButton} onClick={() => navigate('/collection/rarity-review')}>
                  Review Rarity Suggestions
                </Button>
              ) : null}
              <Link to="/discover" className={styles.toolLink}>
                Explore Whiskey
              </Link>
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

          {rarityFilter ? (
            <p className={styles.resultCount}>
              Showing {sortedBottles.length} {sortedBottles.length === 1 ? 'bottle' : 'bottles'} ·{' '}
              {rarityFilter === 'unclassified' ? UNCLASSIFIED_LABEL : RARITY_LABEL[rarityFilter]}
            </p>
          ) : null}

          {sortedBottles.length === 0 ? (
            <EmptyState
              title={
                rarityFilter
                  ? `No bottles match ${rarityFilter === 'unclassified' ? UNCLASSIFIED_LABEL : RARITY_LABEL[rarityFilter]} right now.`
                  : query.trim()
                    ? `No bottles match "${query.trim()}".`
                    : filter === 'core-bar'
                      ? 'No Core Bar bottles yet.'
                      : hasActiveFilter
                        ? `No bottles match ${filterLabel(filter)} right now.`
                        : 'No bottles here yet.'
              }
              message={
                query.trim()
                  ? 'Try a different name, distillery, type, or proof, or clear the search.'
                  : filter === 'core-bar'
                    ? 'Log a few Pour Stories for a bottle to see it earn a permanent spot here.'
                    : hasActiveFilter
                      ? 'Try a different view, or clear the filter to see everything.'
                      : 'Try a different filter, or add a bottle to this view.'
              }
              action={hasActiveFilter ? <Button onClick={clearFilters}>Clear Filters</Button> : undefined}
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

          {!selectMode ? (
            <div className={styles.askAxe}>
              <AxeInlineSuggestion message="Ask AXE about your bar: what to open, what's similar, what's missing." context={{ screen: 'collection' }} />
            </div>
          ) : null}

          {showFilterSheet ? (
            <CollectionFilterSheet
              active={filter}
              counts={Object.fromEntries(ALL_FILTERS.map((f) => [f.value, countForFilter(f.value)])) as Record<Filter, number>}
              onSelect={setFilter}
              onClose={() => setShowFilterSheet(false)}
            />
          ) : null}
        </>
      )}
    </>
  )
}
