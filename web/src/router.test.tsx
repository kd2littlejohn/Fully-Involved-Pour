import { matchRoutes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { routes } from './router'

function matchPath(pathname: string) {
  return matchRoutes(routes, pathname)
}

describe('router', () => {
  it('preserves the old Journal route', () => {
    expect(matchPath('/journal')).not.toBeNull()
  })

  it('adds a /journey alias that redirects to /journal instead of duplicating the page', () => {
    const match = matchPath('/journey')
    expect(match).not.toBeNull()
    const route = match![match!.length - 1]!.route
    expect(route.element).toMatchObject({ type: expect.anything(), props: { to: '/journal', replace: true } })
  })

  it('leaves unrelated routes untouched', () => {
    for (const pathname of [
      '/',
      '/collection',
      '/collection/abc123',
      '/discover',
      '/profile',
      '/blind',
      '/bottles/new',
      '/bottles/abc123/edit',
      '/blind/new',
      '/blind/join',
      '/blind/room-1/lobby',
      '/blind/room-1/taste',
      '/blind/room-1/reveal',
    ]) {
      expect(matchPath(pathname), `expected ${pathname} to still resolve`).not.toBeNull()
    }
  })

  it('every Infinity Bottle route still resolves and carries an errorElement so a page crash cannot blank the whole app', () => {
    for (const pathname of [
      '/collection/infinity',
      '/collection/infinity/abc123',
      '/collection/infinity/abc123/add',
      '/collection/infinity/abc123/tastings',
      '/collection/infinity/abc123/tastings/new',
      '/collection/infinity/abc123/manage',
    ]) {
      const match = matchPath(pathname)
      expect(match, `expected ${pathname} to still resolve`).not.toBeNull()
      const hasErrorBoundary = match!.some((m) => m.route.errorElement != null)
      expect(hasErrorBoundary, `expected ${pathname} to have an errorElement in its route chain`).toBe(true)
    }
  })
})
