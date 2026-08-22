# Project conventions — react-sdd-starter

Authoritative rules for this repo. Claude reads this every session — follow it over habit.
(Project name, and the styling approach + UI library, are set during bootstrap.)

## Commands
- Dev:       npm run dev
- Build:     npm run build
- Typecheck: npm run typecheck
- Lint:      npm run lint
- Test:      npm run test
- E2E:       npm run test:e2e
- Doctor:    npm run doctor

## Component conventions
- Function components only; named exports (no default exports)
- One component per file; colocate `<Component>.test.tsx`
- Props typed with an explicit `<Component>Props` interface
- Data fetching lives in hooks, never inline in components
- Styling + UI library: as recorded in `architecture.md`
- Place every file according to **Folder structure** below

## Folder structure

Fixed layout. Put new files where they belong — do not invent new top-level folders or
rename these.

```
src/
├── main.tsx              # entry — wraps <App/> in <Provider store={store}>
├── App.tsx               # app shell + router
├── store.ts              # RTK Query store (configureStore)
├── routes/               # route / page components (one per route)
├── features/             # feature-scoped code — one folder per domain
│   └── <feature>/
│       ├── components/   #   feature UI + colocated *.test.tsx
│       ├── api.ts        #   RTK Query endpoints (injected into services/api)
│       ├── store.ts      #   feature Zustand store (only if needed)
│       ├── schema.ts     #   Zod schemas for this feature
│       └── types.ts      #   feature-local types
├── components/           # shared, reusable UI + colocated tests
│   └── ui/               #   design-system primitives (shadcn / MUI wrappers)
├── hooks/                # shared reusable hooks (use*)
├── lib/                  # pure logic + utilities + colocated tests
├── services/             # RTK Query base slice (createApi) + shared query code
│   └── api.ts
├── mocks/                # MSW handlers + browser/node servers (from the API contract)
├── stores/               # shared / global Zustand stores
├── types/                # shared TS types
├── styles/               # global styles / tokens
└── test/setup.ts         # test setup
e2e/                      # Playwright specs
```

Placement rules:
- Pure function → `src/lib/`. Shared hook → `src/hooks/`. Shared type → `src/types/`.
- Anything specific to one domain → `src/features/<domain>/` (its components, endpoints,
  Zustand store, Zod schema, and types live together).
- RTK Query base slice → `src/services/api.ts`; feature endpoints inject into it from
  `src/features/<domain>/api.ts`.
- Reusable UI → `src/components/` (`components/ui/` for primitives); pages → `src/routes/`.
- Tests are colocated next to the file they test; only Playwright specs live in `e2e/`.
- Small apps may start with just the top-level folders and add `features/<domain>/` as they
  grow — keep these names; never add a parallel folder that does the same job.

## State, data fetching & forms (fixed rules)

Three libraries, three jobs — do not mix them up:

| Concern | Library | Never use instead |
|---|---|---|
| Server state / data fetching | **RTK Query** | raw `fetch`/`axios` in components |
| Client / UI state | **Zustand** | Redux slices for UI state |
| Forms + validation | **React Hook Form + Zod** | uncontrolled ad-hoc validation |

### Server state + data fetching — RTK Query
- All server data goes through RTK Query (from `@reduxjs/toolkit`). No raw `fetch`/`axios`
  in components or hooks.
- Define endpoints in an api slice; use `tagTypes` for cache invalidation; components
  consume the generated hooks (`useGetXQuery`, `useAddXMutation`).
- Redux Toolkit exists in this project **only** as the RTK Query API layer.
- If an OpenAPI/Swagger spec exists, prefer generating this layer — see **API contracts &
  mocking** below. The hand-written form below is for when there's no clean spec.

```ts
// src/services/api.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Item'],
  endpoints: (build) => ({
    getItems: build.query<Item[], void>({
      query: () => 'items',
      providesTags: ['Item'],
    }),
    addItem: build.mutation<Item, NewItem>({
      query: (body) => ({ url: 'items', method: 'POST', body }),
      invalidatesTags: ['Item'],
    }),
  }),
})
export const { useGetItemsQuery, useAddItemMutation } = api
```

```ts
// src/store.ts  — wrap <App/> in <Provider store={store}>
import { configureStore } from '@reduxjs/toolkit'
import { api } from './services/api'

export const store = configureStore({
  reducer: { [api.reducerPath]: api.reducer },
  middleware: (getDefault) => getDefault().concat(api.middleware),
})
```

### Client / UI state — Zustand
- Local and cross-component client state (UI toggles, filters, wizard steps, selected rows)
  lives in Zustand stores — not Redux.
- One store per concern; keep stores small; **select narrowly** to avoid re-renders.

```ts
// src/stores/useUiStore.ts
import { create } from 'zustand'

interface UiState {
  sidebarOpen: boolean
  toggleSidebar: () => void
}
export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}))

// usage — narrow selector, not the whole store:
// const open = useUiStore((s) => s.sidebarOpen)
```

### Forms + validation — React Hook Form + Zod
- Every form uses `react-hook-form` with a Zod schema via `@hookform/resolvers/zod`.
- The Zod schema is the single source of truth; infer the TS type from it with `z.infer`.
- Reuse Zod schemas to validate RTK Query request/response payloads where it adds safety.

```tsx
// src/features/<feature>/components/ExampleForm.tsx  (shared form → src/components/)
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  quantity: z.coerce.number().positive('Must be greater than 0'),
})
export type ExampleValues = z.infer<typeof schema>

export interface ExampleFormProps { onSubmit: (v: ExampleValues) => void }

export function ExampleForm({ onSubmit }: ExampleFormProps) {
  const { register, handleSubmit, formState: { errors } } =
    useForm<ExampleValues>({ resolver: zodResolver(schema) })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <label htmlFor="name">Name</label>
      <input id="name" {...register('name')} />
      {errors.name && <p role="alert">{errors.name.message}</p>}

      <label htmlFor="quantity">Quantity</label>
      <input id="quantity" inputMode="numeric" {...register('quantity')} />
      {errors.quantity && <p role="alert">{errors.quantity.message}</p>}

      <button type="submit">Save</button>
    </form>
  )
}
```

## API contracts & mocking (fixed rules)

The API contract is a **first-class artifact**. Establish it BEFORE building the data layer or
UI, and never hand-code endpoints from memory. Record its source in `architecture.md`.

Three cases — pick based on what exists:

1. **OpenAPI / Swagger spec exists** → decide per project:
   - Clean, reasonably complete spec → **generate** the RTK Query layer with
     `@rtk-query/codegen-openapi` (typed endpoints + hooks for free). Regenerate with
     `npm run gen:api`. Don't hand-edit the generated file.
   - Partial / messy spec → hand-write the api slice (still fully typed), using the spec as
     reference.
2. **Informal contract** (Postman collection, sample JSON, a written description) → capture it
   as Zod schemas in `src/features/<domain>/schema.ts`. Those become the source of truth.
3. **Frontend-first (API not built yet)** → write the contract FIRST — Zod schemas or an
   OpenAPI stub, whichever exists (if neither, write the Zod schemas). Stand up MSW mocks from
   it and develop + test against the mock. When the real backend ships, disable mocking; if it
   honored the contract, nothing else changes.

### Mocking — MSW (default everywhere)
- MSW is the default mock layer for dev (frontend-first) **and** for component + e2e tests.
- Handlers live in `src/mocks/`, derived from the contract (Zod schemas or OpenAPI).
- Keep mock fixtures valid against the Zod schemas so the mock can't drift from the contract.

### Runtime guard
- Validate RTK Query responses with the Zod schema via `transformResponse`, so a backend that
  drifts from the agreed shape fails loudly instead of silently.

```ts
// codegen (case 1a): src/services/emptyApi.ts + openapi-config.ts, then `npm run gen:api`
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
export const emptyApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: () => ({}),
})
// openapi-config.ts
import type { ConfigFile } from '@rtk-query/codegen-openapi'
const config: ConfigFile = {
  schemaFile: './openapi.json',        // or a URL to the live Swagger
  apiFile: './src/services/emptyApi.ts',
  apiImport: 'emptyApi',
  outputFile: './src/services/generatedApi.ts',
  hooks: true,
}
export default config
```

```ts
// response guard (any case): validate against the Zod schema
getItems: build.query<Item[], void>({
  query: () => 'items',
  transformResponse: (raw) => z.array(itemSchema).parse(raw),
}),
```

```ts
// mocks from the contract:  src/mocks/handlers.ts
import { http, HttpResponse } from 'msw'
import { itemSchema } from '../features/items/schema'
const items = [itemSchema.parse({ id: '1', name: 'Example' })]  // fixture must satisfy the schema
export const handlers = [
  http.get('/api/items', () => HttpResponse.json(items)),
]
// src/mocks/browser.ts  → setupWorker(...handlers)   (dev / frontend-first)
// src/mocks/server.ts   → setupServer(...handlers)   (tests)
```

## Testing (details in the feature-pipeline skill)
- Unit for pure logic; component tests via Testing Library (query by label/role);
  Playwright for the key flow.
- **MSW is the default mock layer** for component + e2e tests. The node server is started in
  `src/test/setup.ts` (`listen` / `resetHandlers` / `close`); for e2e, run the dev server with
  mocking enabled or hit a real backend when one exists.
- Test Zustand stores as plain functions; test Zod schemas directly for edge cases.

## Definition of done (self-check ALL before stopping)
```
npm run typecheck && npm run lint && npm run test && npm run doctor
```
