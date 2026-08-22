import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { z } from 'zod'
import { itemSchema, type Item, type NewItem } from '../features/items/schema'

// Hand-written form (no clean OpenAPI spec). When a spec exists, generate this
// instead — see CLAUDE.md -> API contracts and src/services/emptyApi.ts.
export const api = createApi({
  reducerPath: 'api',
  // Absolute so Node's Request (tests) can parse it; same-origin in the browser.
  baseQuery: fetchBaseQuery({ baseUrl: `${globalThis.location?.origin ?? ''}/api` }),
  tagTypes: ['Item'],
  endpoints: (build) => ({
    getItems: build.query<Item[], void>({
      query: () => 'items',
      transformResponse: (raw) => z.array(itemSchema).parse(raw),
      providesTags: ['Item'],
    }),
    addItem: build.mutation<Item, NewItem>({
      query: (body) => ({ url: 'items', method: 'POST', body }),
      transformResponse: (raw) => itemSchema.parse(raw),
      invalidatesTags: ['Item'],
    }),
  }),
})

export const { useGetItemsQuery, useAddItemMutation } = api
