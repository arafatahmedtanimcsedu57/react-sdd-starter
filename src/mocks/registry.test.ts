import { describe, expect, it } from 'vitest'
import { handlers } from './handlers'

// The guard for self-registering mocks: every *.handlers.ts exports a `handlers` array (and
// `reset`, if any, is a function), and no two mock the same request — MSW would silently use
// whichever file sorts first.
const files = import.meta.glob<{ handlers?: unknown; reset?: unknown }>('./*.handlers.ts', {
  eager: true,
})

describe('mock registry', () => {
  // A fresh project (after /start removes the example) may have no mock files yet.
  it('every *.handlers.ts exports a handlers array, and all of them are served', () => {
    const bad = Object.entries(files)
      .filter(([, m]) => !Array.isArray(m.handlers) || (m.reset && typeof m.reset !== 'function'))
      .map(([f]) => f)
    expect(bad).toEqual([])
    const total = Object.values(files).reduce((n, m) => n + (m.handlers as unknown[]).length, 0)
    expect(handlers).toHaveLength(total)
  })

  it('no two handlers mock the same method and URL', () => {
    const keys = handlers.map((h) => {
      const info = h.info as { method?: unknown; path?: unknown; header: string }
      return info.method ? `${String(info.method)} ${String(info.path)}` : info.header
    })
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([])
  })
})
