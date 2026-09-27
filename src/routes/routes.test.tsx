import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderRoute } from '../test/render'
import { RootLayout } from './RootLayout'
import { RouteError } from './RouteError'

describe('routes', () => {
  it('renders the items page at /', async () => {
    renderRoute('/')
    expect(await screen.findByRole('heading', { name: /items/i })).toBeInTheDocument()
  })

  it('shows "Page not found" for an unknown URL', async () => {
    renderRoute('/does-not-exist')
    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument()
  })

  it('catches a page that crashes while rendering', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function Broken(): never {
      throw new Error('boom')
    }
    renderRoute('/', [
      {
        path: '/',
        Component: RootLayout,
        errorElement: <RouteError />,
        children: [{ index: true, Component: Broken }],
      },
    ])
    expect(await screen.findByRole('heading', { name: /something went wrong/i })).toBeVisible()
  })
})
