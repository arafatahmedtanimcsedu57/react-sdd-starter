# Design — self-registering routes and mocks

No UI change (same pages, same mocks).

## Routes

```tsx
// src/routes/items.route.tsx
import type { RouteObject } from 'react-router'
export const route: RouteObject = {
  index: true,
  lazy: async () => ({ Component: (await import('./ItemsPage')).ItemsPage }),
}

// src/routes/routes.tsx
const files = import.meta.glob<{ route: RouteObject }>('./*.route.tsx', { eager: true })
export const pageRoutes = Object.values(files).map((m) => m.route)
export const routes: RouteObject[] = [
  {
    path: '/',
    Component: RootLayout,
    errorElement: <RouteError />,
    HydrateFallback: RouteLoading,
    children: pageRoutes,
  },
]
```

`eager: true` loads only the tiny route objects; pages stay lazy chunks (bundle budget
unchanged). Works in Vite and Vitest alike.

## Mocks

```ts
// src/mocks/items.handlers.ts
export const handlers = [/* as today */]
export function reset() {
  items = seed()
}

// src/mocks/handlers.ts
const files = import.meta.glob<{ handlers: RequestHandler[]; reset?: () => void }>(
  './*.handlers.ts',
  { eager: true },
)
export const handlers = Object.values(files).flatMap((m) => m.handlers)
export function resetMockData() {
  for (const m of Object.values(files)) m.reset?.()
}
```

## Guard (`src/routes/registry.test.ts`, `src/mocks/registry.test.ts`)

Every glob module exports what it must; no two routes share `path` (or two `index`).

## Rejected

- **Feature folders own their routes** (`src/features/<f>/route.tsx`) — `features/` may not
  import `routes/` (pages); changing the import rules is a bigger decision.
- **A generated registry file** (script writes `routes.tsx`) — the generated file conflicts
  just like the hand-written one.
