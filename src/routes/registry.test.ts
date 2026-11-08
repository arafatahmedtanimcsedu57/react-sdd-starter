import { describe, expect, it } from 'vitest'

// The guard for self-registering pages: every *.route.tsx exports a `route`, and no two
// claim the same path (a duplicate would silently shadow the other page).
const files = import.meta.glob<{ route?: unknown }>('./*.route.tsx', { eager: true })

describe('route registry', () => {
  it('every *.route.tsx exports a route', () => {
    const missing = Object.entries(files)
      .filter(([, m]) => !m.route)
      .map(([f]) => f)
    expect(missing).toEqual([])
    expect(Object.keys(files).length).toBeGreaterThan(0)
  })

  it('no two route files claim the same path', () => {
    const paths = Object.values(files).map((m) => {
      const r = m.route as { index?: boolean; path?: string }
      return r.index ? '(index)' : (r.path ?? '').replace(/^\/+|\/+$/g, '')
    })
    expect(paths.filter((p, i) => paths.indexOf(p) !== i)).toEqual([])
  })
})
