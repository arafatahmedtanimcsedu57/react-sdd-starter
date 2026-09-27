import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { makeStore } from '../store'

/** Render with a fresh Redux store so RTK Query cache never leaks between tests. */
export function renderWithStore(ui: ReactElement) {
  const store = makeStore()
  return { store, ...render(<Provider store={store}>{ui}</Provider>) }
}
