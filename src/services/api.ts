import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQuery } from './baseQuery'

// The app's single RTK Query slice. Hand-written endpoints inject from
// src/features/<domain>/api.ts; `npm run gen:api` injects generated ones into this same slice
// (src/services/generatedApi.ts), so there is one cache and one store entry either way.
export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  endpoints: () => ({}),
})
