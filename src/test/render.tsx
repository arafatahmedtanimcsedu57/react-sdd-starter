import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import { makeStore } from '../store'
import { routes as appRoutes } from '../routes/routes'

/** Render with a fresh Redux store so RTK Query cache never leaks between tests. */
export function renderWithStore(ui: ReactElement) {
  const store = makeStore()
  return { store, ...render(<Provider store={store}>{ui}</Provider>) }
}

/** Render the app's router (or the given routes) at `path`, with a fresh store. */
export function renderRoute(path: string, routes: RouteObject[] = appRoutes) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  return { router, ...renderWithStore(<RouterProvider router={router} />) }
}
