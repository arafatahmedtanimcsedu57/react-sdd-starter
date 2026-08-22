import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

// Base slice for RTK Query codegen (npm run gen:api injects endpoints here).
export const emptyApi = createApi({
  reducerPath: 'generatedApi',
  baseQuery: fetchBaseQuery({ baseUrl: `${globalThis.location?.origin ?? ''}/api` }),
  endpoints: () => ({}),
})
