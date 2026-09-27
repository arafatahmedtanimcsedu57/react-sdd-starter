import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server'
import { renderWithStore } from '../test/render'
import { ItemsPage } from './ItemsPage'

describe('ItemsPage', () => {
  it('lists items from the API', async () => {
    renderWithStore(<ItemsPage />)
    expect(await screen.findByText('Sample item')).toBeInTheDocument()
  })

  it('shows an empty state', async () => {
    server.use(http.get('/api/items', () => HttpResponse.json([])))
    renderWithStore(<ItemsPage />)
    expect(await screen.findByText(/no items yet/i)).toBeInTheDocument()
  })

  it('shows an error when the response breaks the contract', async () => {
    server.use(http.get('/api/items', () => HttpResponse.json([{ id: 1 }])))
    renderWithStore(<ItemsPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i)
  })
})
