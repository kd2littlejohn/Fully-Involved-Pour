export interface NavItem {
  label: string
  path: string
}

// Route destinations for the primary nav. The centre action, AXE (the AXE
// Hub at /axe, which replaced the old Pour tab and holds every Pour
// workflow), has its own prominent button (AxeNavButton), so it isn't
// listed here; TopNav/BottomNav splice it in between index 1 ("My Bar") and
// index 2 ("Journey"): Home | My Bar | AXE | Journey | Friends.
//
// "Discover" was removed from this list per the 2026-08-15 nav redesign —
// it's no longer a permanent bottom-nav destination, but the /discover
// route and page are untouched and stay reachable from Home and My Bar.
//
// "Profile" was replaced by "Friends" per the 2026-08-21 Friends redesign —
// Friends is now a primary destination, matching the attached spec. Profile
// itself isn't gone: it's reached via the avatar button in the app header
// (see TopNav.tsx / MobileTopBar.tsx) instead of a permanent nav slot.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '/' },
  { label: 'My Bar', path: '/collection' },
  { label: 'Journey', path: '/journal' },
  { label: 'Friends', path: '/friends' },
]
