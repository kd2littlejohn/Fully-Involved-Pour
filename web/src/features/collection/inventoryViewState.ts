import { useEffect, useLayoutEffect, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { RARITY_OPTIONS } from '../rarity/rarityLevels'
import type { RarityFilterValue } from '../rarity/rarityFilter'
import { ALL_FILTERS, type Filter } from './collectionFilters'
import { SORT_OPTIONS, type SortOption } from './sortBottles'

// My Bar's view state — search, filters, sort and grid/list — lives in the
// URL (?q=&filter=&rarity=&sort=&view=), written with `replace` so typing
// and toggling don't pile up history entries. That alone makes browser /
// gesture Back and a refresh land on the same view.
//
// A per-user, per-tab sessionStorage copy (plus the list's scroll position)
// covers everything that reaches My Bar *without* those params: "Back to
// My Bar" from a bottle, returning after a delete, or tapping My Bar in the
// nav. The view only resets when the user clears it themselves. Nothing
// here touches Firestore — the bottles are already in useUserData.

export type InventoryViewMode = 'grid' | 'list'

export interface InventoryView {
  query: string
  filter: Filter
  rarity: RarityFilterValue
  sort: SortOption
  view: InventoryViewMode
}

export const DEFAULT_INVENTORY_VIEW: InventoryView = { query: '', filter: 'all', rarity: null, sort: 'recent', view: 'grid' }

export function parseInventoryView(params: URLSearchParams): InventoryView {
  const filter = params.get('filter')
  const rarity = params.get('rarity')
  const sort = params.get('sort')
  const view = params.get('view')
  return {
    query: params.get('q') ?? '',
    filter: ALL_FILTERS.some((f) => f.value === filter) ? (filter as Filter) : 'all',
    rarity: rarity === 'unclassified' || RARITY_OPTIONS.some((r) => r.value === rarity) ? (rarity as RarityFilterValue) : null,
    sort: SORT_OPTIONS.some((s) => s.value === sort) ? (sort as SortOption) : 'recent',
    view: view === 'list' ? 'list' : 'grid',
  }
}

// Defaults are left out, so a reset view is just "/collection".
export function inventoryViewToParams(view: InventoryView): URLSearchParams {
  const params = new URLSearchParams()
  if (view.query) params.set('q', view.query)
  if (view.filter !== 'all') params.set('filter', view.filter)
  if (view.rarity !== null) params.set('rarity', view.rarity)
  if (view.sort !== 'recent') params.set('sort', view.sort)
  if (view.view !== 'grid') params.set('view', view.view)
  return params
}

export function inventorySearchString(view: InventoryView): string {
  const s = inventoryViewToParams(view).toString()
  return s ? `?${s}` : ''
}

interface SavedInventoryState {
  search: string
  scrollY: number
}

function storageKey(uid: string): string {
  return `fip-inventory-view:${uid}`
}

// Every access is guarded: storage can be unavailable (private mode, blocked
// site data). Losing it just means My Bar opens unfiltered, as before.
export function readSavedInventory(uid: string | undefined): SavedInventoryState | undefined {
  if (!uid) return undefined
  try {
    const raw = sessionStorage.getItem(storageKey(uid))
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as Partial<SavedInventoryState>
    return {
      search: typeof parsed.search === 'string' ? parsed.search : '',
      scrollY: typeof parsed.scrollY === 'number' && parsed.scrollY > 0 ? parsed.scrollY : 0,
    }
  } catch {
    return undefined
  }
}

export function writeSavedInventory(uid: string | undefined, patch: Partial<SavedInventoryState>): void {
  if (!uid) return
  try {
    const current = readSavedInventory(uid) ?? { search: '', scrollY: 0 }
    sessionStorage.setItem(storageKey(uid), JSON.stringify({ ...current, ...patch }))
  } catch {
    // Best-effort only.
  }
}

// Where "Back to My Bar" (and similar) should go: the user's last My Bar
// view, or the plain list if there isn't one.
export function useInventoryReturnPath(): string {
  const { user } = useAuth()
  return `/collection${readSavedInventory(user?.uid)?.search ?? ''}`
}

// Initial view for a fresh My Bar mount: explicit URL params win (deep
// links like Home's "View All open bottles", Back, refresh); with none, the
// session's last view is restored.
export function initialInventoryView(urlSearch: string, uid: string | undefined): { view: InventoryView; restored: boolean } {
  const fromUrl = new URLSearchParams(urlSearch)
  if ([...fromUrl.keys()].length > 0) return { view: parseInventoryView(fromUrl), restored: false }
  const saved = readSavedInventory(uid)
  if (saved?.search) return { view: parseInventoryView(new URLSearchParams(saved.search)), restored: true }
  return { view: DEFAULT_INVENTORY_VIEW, restored: false }
}

const RESTORE_WINDOW_MS = 1500

// Saves the list's scroll position while it's on screen, and puts it back
// when returning to the same view. Bottle cards size to their photos, so
// the position is re-applied while images load, for a short window or until
// the user scrolls/taps themselves, whichever comes first.
export function useInventoryScrollRestoration(uid: string | undefined, ready: boolean, search: string): void {
  const restoredRef = useRef(false)

  useLayoutEffect(() => {
    if (!ready || restoredRef.current) return
    restoredRef.current = true
    const saved = readSavedInventory(uid)
    if (!saved || saved.search !== search || saved.scrollY <= 0) return
    const target = saved.scrollY
    const apply = () => {
      try {
        window.scrollTo(0, target)
      } catch {
        // jsdom / very old browsers
      }
    }
    apply()

    let stopped = false
    const stop = () => {
      stopped = true
      observer?.disconnect()
      for (const type of USER_SCROLL_EVENTS) window.removeEventListener(type, stop)
      window.clearTimeout(timer)
    }
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (!stopped) apply()
          })
        : undefined
    observer?.observe(document.body)
    for (const type of USER_SCROLL_EVENTS) window.addEventListener(type, stop, { passive: true })
    const timer = window.setTimeout(stop, RESTORE_WINDOW_MS)
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once per mount, when the list first renders
  }, [ready])

  useEffect(() => {
    if (!ready) return
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        writeSavedInventory(uid, { scrollY: Math.round(window.scrollY) })
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [ready, uid])
}

const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
