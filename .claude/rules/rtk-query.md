---
paths:
  - 'src/services/**'
  - 'src/features/*/api.ts'
  - 'src/store.ts'
  - 'openapi-config.ts'
---

# RTK Query — code patterns

Rules are in `CLAUDE.md` → State, data fetching & forms, and API contracts & mocking.

The hand-written form, for when there's no clean OpenAPI spec:

```ts
// src/services/api.ts — the ONE slice, no endpoints. baseQuery adds the base URL from env,
// the Bearer token from useSessionStore, and signs out on 401. Never create a second slice.
export const api = createApi({ reducerPath: 'api', baseQuery, endpoints: () => ({}) })

// src/features/items/api.ts — the feature owns its endpoints + tags
export const itemsApi = api.enhanceEndpoints({ addTagTypes: ['Item'] }).injectEndpoints({
  endpoints: (build) => ({
    getItems: build.query<Item[], void>({ query: () => 'items', providesTags: ['Item'] }),
    addItem: build.mutation<Item, NewItem>({
      query: (body) => ({ url: 'items', method: 'POST', body }),
      invalidatesTags: ['Item'],
    }),
  }),
})
export const { useGetItemsQuery, useAddItemMutation } = itemsApi
```

`src/store.ts` exports `makeStore()` (fresh store per test via `src/test/render.tsx`) and the
app's `store`, which `main.tsx` passes to `<Provider>`.

```ts
// codegen (case 1a): generated endpoints inject into the same `api` slice, then `npm run gen:api`
// openapi-config.ts
import type { ConfigFile } from '@rtk-query/codegen-openapi'
const config: ConfigFile = {
  schemaFile: './openapi.json', // or a URL to the live Swagger
  apiFile: './src/services/api.ts',
  apiImport: 'api',
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
