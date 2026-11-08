import type { RequestHandler } from 'msw'

// Every mock, collected from src/mocks/*.handlers.ts (each exports `handlers`, and `reset`
// if it keeps state). Add a feature's mocks: create <feature>.handlers.ts — never edit this
// file. browser.ts (dev) and server.ts (tests) both start from this list.
export interface MockFile {
  handlers: RequestHandler[]
  reset?: () => void
}

const files = import.meta.glob<MockFile>('./*.handlers.ts', { eager: true })

export const handlers: RequestHandler[] = Object.values(files).flatMap((file) => file.handlers)

/** Restore every mock's fixtures; called between tests. */
export function resetMockData() {
  for (const file of Object.values(files)) file.reset?.()
}
