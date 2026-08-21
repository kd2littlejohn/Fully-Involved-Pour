import { describe, expect, it } from 'vitest'
import { NAV_ITEMS } from './navItems'

describe('NAV_ITEMS', () => {
  it('lists the route destinations in nav order, excluding Pour (an action, not a route) and Discover (moved out of the permanent nav)', () => {
    expect(NAV_ITEMS).toEqual([
      { label: 'Home', path: '/' },
      { label: 'My Bar', path: '/collection' },
      { label: 'Journey', path: '/journal' },
      { label: 'Friends', path: '/friends' },
    ])
  })
})
