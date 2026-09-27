import { z } from 'zod'
import { api } from '../../services/api'
import { itemSchema, type Item, type NewItem } from './schema'

export const itemsApi = api.enhanceEndpoints({ addTagTypes: ['Item'] }).injectEndpoints({
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

export const { useGetItemsQuery, useAddItemMutation } = itemsApi
