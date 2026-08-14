export interface NavItem {
  label: string
  path: string
}

// Canonical 5-tab nav per FIP_PRODUCT_VISION_AND_DESIGN_SYSTEM.md §7/§24.
// "My Bar" (was "Collection") and "Journey" (was "Journal") per the user's
// 2026-08-14 refinement — warmer, more personal terminology; route paths
// are unchanged, this is copy only.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '/' },
  { label: 'My Bar', path: '/collection' },
  { label: 'Journey', path: '/journal' },
  { label: 'Discover', path: '/discover' },
  { label: 'Profile', path: '/profile' },
]
