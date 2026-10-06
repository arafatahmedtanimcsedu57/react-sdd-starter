import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetMockData } from '../mocks/handlers'
import { server } from '../mocks/server'
import { useSessionStore } from '../stores/useSessionStore'
import { useUiStore } from '../stores/useUiStore'

const initialUiState = useUiStore.getState()
const initialSessionState = useSessionStore.getState()

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockData()
  useUiStore.setState(initialUiState, true)
  useSessionStore.setState(initialSessionState, true)
  cleanup()
})
afterAll(() => server.close())
