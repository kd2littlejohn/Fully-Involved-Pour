export interface NavItem {
  label: string
  path: string
}

// Canonical 5-tab nav per FIP_PRODUCT_VISION_AND_DESIGN_SYSTEM.md §7/§24.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: '/' },
  { label: 'Collection', path: '/collection' },
  { label: 'Journal', path: '/journal' },
  { label: 'Discover', path: '/discover' },
  { label: 'Profile', path: '/profile' },
]
