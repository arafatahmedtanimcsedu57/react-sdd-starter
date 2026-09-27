import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import { apiBaseUrl } from '../lib/env'
import { useSessionStore } from '../stores/useSessionStore'
import { makeStore } from '../store'
import { api } from './api'

const probeApi = api.injectEndpoints({
  endpoints: (build) => ({ probe: build.query<unknown, void>({ query: () => 'probe' }) }),
})

describe('baseQuery', () => {
  it('sends the session token as a bearer header', async () => {
    let auth: string | null = null
    server.use(
      http.get(`${apiBaseUrl}/probe`, ({ request }) => {
        auth = request.headers.get('Authorization')
        return HttpResponse.json({})
      }),
    )
    useSessionStore.getState().signIn('abc')
    await makeStore().dispatch(probeApi.endpoints.probe.initiate())
    expect(auth).toBe('Bearer abc')
  })

  it('signs out when the API answers 401', async () => {
    server.use(http.get(`${apiBaseUrl}/probe`, () => new HttpResponse(null, { status: 401 })))
    useSessionStore.getState().signIn('expired')
    await makeStore().dispatch(probeApi.endpoints.probe.initiate())
    expect(useSessionStore.getState().token).toBeNull()
  })
})
