export interface NavItem {
  label: string
  path: string
}

// Route destinations for the primary nav. "Pour" (the center action) isn't
// a route — it opens the Pour hub modal (see PourNavButton/usePourHub) — so
// it isn't listed here; TopNav/BottomNav splice PourNavButton in between
// index 1 ("My Bar") and index 2 ("Journey") to get the required order:
// Home | My Bar | Pour | Journey | Profile.
//
// "Discover" was removed from this list per the 2026-08-15 nav redesign —
// it's no longer a permanent bottom-nav destination, but the /discover
// route and page are untouched and stay reachable from Home and My Bar.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '/' },
  { label: 'My Bar', path: '/collection' },
  { label: 'Journey', path: '/journal' },
  { label: 'Profile', path: '/profile' },
]
