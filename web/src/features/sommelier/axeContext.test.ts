import { describe, expect, it } from 'vitest'
import { copyFor, resolveRouteContext, type AxeScreen } from './axeContext'
import { routes } from '../../router'
import { matchRoutes } from 'react-router-dom'

describe('resolveRouteContext', () => {
  it.each([
    ['/', { screen: 'home' }],
    ['/axe', { screen: 'hub' }],
    ['/pour', { screen: 'hub' }],
    ['/collection', { screen: 'collection' }],
    ['/collection/rarity-review', { screen: 'collection' }],
    ['/collection/b1', { screen: 'bottle', bottleId: 'b1' }],
    ['/collection/infinity', { screen: 'infinity' }],
    ['/collection/infinity/inf1', { screen: 'infinity', infinityBottleId: 'inf1' }],
    ['/collection/infinity/inf1/add', { screen: 'infinity', infinityBottleId: 'inf1' }],
    ['/collection/infinity/inf1/tastings/new', { screen: 'log-tasting', infinityBottleId: 'inf1' }],
    ['/journal', { screen: 'journal' }],
    ['/discover', { screen: 'discover' }],
    ['/profile', { screen: 'palate' }],
    ['/friends', { screen: 'friends' }],
    ['/friends/u/sam', { screen: 'friends', friendUsername: 'sam' }],
    ['/friends/u/sam/story', { screen: 'friends', friendUsername: 'sam' }],
    ['/friends/shared/m1', { screen: 'friends' }],
    ['/blind', { screen: 'blind' }],
    ['/blind/r1/reveal', { screen: 'blind', roomId: 'r1' }],
    ['/settings', { screen: 'general' }],
  ])('%s → %o', (path, expected) => {
    expect(resolveRouteContext(path)).toEqual(expected)
  })

  it('covers every AppShell route with a real screen (no route silently falls back to general)', () => {
    const shellChildren = (routes[0]?.children ?? []).flatMap((r) => (r.children ? r.children : [r]))
    for (const route of shellChildren) {
      if (!route.path || route.path.includes('journey')) continue
      const samplePath = route.path.replace(/:[A-Za-z]+/g, 'x1')
      expect(matchRoutes(routes, samplePath)).not.toBeNull()
      expect(resolveRouteContext(samplePath).screen).not.toBe('general')
    }
  })

  it('gives every screen an intro and four suggested questions', () => {
    const screens: AxeScreen[] = [
      'home', 'hub', 'collection', 'bottle', 'pour-recommendation', 'log-tasting', 'palate',
      'blind', 'friends', 'journal', 'infinity', 'discover', 'general',
    ]
    for (const screen of screens) {
      const copy = copyFor(screen)
      expect(copy.title).toBeTruthy()
      expect(copy.intro).toBeTruthy()
      expect(copy.suggestions).toHaveLength(4)
    }
  })

  it('labels the AXE Hub as its own source, never as Home', () => {
    expect(copyFor('hub').label).toBe('AXE Hub')
    expect(copyFor('home').label).toBe('Home')
  })
})
