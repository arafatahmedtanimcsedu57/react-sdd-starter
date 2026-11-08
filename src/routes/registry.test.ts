import type { RouteObject } from 'react-router'
import { describe, expect, it } from 'vitest'

// The guard for self-registering pages: every *.route.tsx exports a `route`, pages stay lazy,
// and no two files claim the same URL (one would silently shadow the other).
const files = import.meta.glob<{ route?: RouteObject }>('./*.route.tsx', { eager: true })
const routes = Object.values(files).flatMap((m) => (m.route ? [m.route] : []))

/** Every route with the full URL it serves; pathless layouts add no URL of their own. */
function flatten(list: RouteObject[], parent = ''): { url: string; route: RouteObject }[] {
  return list.flatMap((r) => {
    const own = r.index ? parent : r.path === undefined ? null : join(parent, r.path)
    const here = own === null ? [] : [{ url: own, route: r }]
    return [...here, ...flatten(r.children ?? [], own ?? parent)]
  })
}
// React Router matches case-insensitively, and `index` under `/` is the same URL as `/`.
const join = (a: string, b: string) =>
  [a, b]
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '')
    .toLowerCase()

describe('route registry', () => {
  it('every *.route.tsx exports a route', () => {
    const missing = Object.entries(files)
      .filter(([, m]) => !m.route)
      .map(([f]) => f)
    expect(missing).toEqual([])
    expect(routes.length).toBeGreaterThan(0)
  })

  it('no two routes serve the same URL', () => {
    // Only routes that render a page count: a layout with children shares its URL with them.
    const urls = flatten(routes)
      .filter(({ route }) => route.lazy || route.Component || route.element)
      .filter(({ route }) => !route.children?.length)
      .map(({ url }) => url || '/')
    expect(urls.filter((u, i) => urls.indexOf(u) !== i)).toEqual([])
  })

  it('pages stay lazy (each its own chunk)', () => {
    const eager = flatten(routes)
      .filter(({ route }) => route.Component || route.element)
      .map(({ url }) => url || '/')
    expect(eager).toEqual([])
  })
})
