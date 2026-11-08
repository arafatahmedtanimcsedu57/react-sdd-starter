import { describe, expect, it } from 'vitest'
import { handlers } from './handlers'

// The guard for self-registering mocks: every *.handlers.ts exports a `handlers` array.
const files = import.meta.glob<{ handlers?: unknown }>('./*.handlers.ts', { eager: true })

describe('mock registry', () => {
  // A fresh project (after /start removes the example) may have no mock files yet.
  it('every *.handlers.ts exports a handlers array, and all of them are served', () => {
    const missing = Object.entries(files)
      .filter(([, m]) => !Array.isArray(m.handlers))
      .map(([f]) => f)
    expect(missing).toEqual([])
    const total = Object.values(files).reduce((n, m) => n + (m.handlers as unknown[]).length, 0)
    expect(handlers).toHaveLength(total)
  })
})
