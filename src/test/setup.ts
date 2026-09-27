import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetMockData } from '../mocks/handlers'
import { server } from '../mocks/server'
import { useUiStore } from '../stores/useUiStore'

const initialUiState = useUiStore.getState()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetMockData()
  useUiStore.setState(initialUiState, true)
  cleanup()
})
afterAll(() => server.close())
