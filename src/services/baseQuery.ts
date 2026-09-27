import { fetchBaseQuery, type BaseQueryFn } from '@reduxjs/toolkit/query/react'
import type { FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { apiBaseUrl } from '../lib/env'
import { useSessionStore } from '../stores/useSessionStore'

const rawBaseQuery = fetchBaseQuery({
  baseUrl: apiBaseUrl,
  prepareHeaders: (headers) => {
    const token = useSessionStore.getState().token
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})

/**
 * The one base query every endpoint uses: adds the auth header and ends the session on 401.
 * Token refresh goes here too (retry once after refreshing) once the backend supports it.
 */
export const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  const result = await rawBaseQuery(args, api, extraOptions)
  if (result.error?.status === 401) useSessionStore.getState().signOut()
  return result
}
