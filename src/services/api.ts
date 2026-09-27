import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

// Base RTK Query slice. Features inject their endpoints from src/features/<domain>/api.ts.
// Hand-written form (no clean OpenAPI spec). When a spec exists, generate endpoints
// instead — see CLAUDE.md -> API contracts and src/services/emptyApi.ts.
export const api = createApi({
  reducerPath: 'api',
  // Absolute so Node's Request (tests) can parse it; same-origin in the browser.
  baseQuery: fetchBaseQuery({ baseUrl: `${globalThis.location?.origin ?? ''}/api` }),
  endpoints: () => ({}),
})
