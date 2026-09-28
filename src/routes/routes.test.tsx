import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderRoute } from '../test/render'
import { RootLayout } from './RootLayout'
import { RouteError } from './RouteError'
import { reportError } from '../lib/monitoring'

vi.mock('../lib/monitoring', () => ({ reportError: vi.fn() }))

describe('routes', () => {
  beforeEach(() => vi.mocked(reportError).mockClear())

  it('renders the items page at /', async () => {
    renderRoute('/')
    expect(await screen.findByRole('heading', { name: /items/i })).toBeInTheDocument()
  })

  it('shows "Page not found" for an unknown URL', async () => {
    renderRoute('/does-not-exist')
    expect(await screen.findByRole('heading', { name: /page not found/i })).toBeInTheDocument()
    expect(reportError).not.toHaveBeenCalled()
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
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }))
  })
})
