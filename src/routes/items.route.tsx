import type { RouteObject } from 'react-router'

// One page = one *.route.tsx file; routes.tsx collects them, so adding a page never edits a
// shared file. The page itself stays lazy-loaded (its own chunk).
export const route: RouteObject = {
  index: true,
  lazy: async () => ({ Component: (await import('./ItemsPage')).ItemsPage }),
}
