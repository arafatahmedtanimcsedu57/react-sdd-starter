import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../../mocks/server'
import { renderWithStore } from '../../../test/render'
import { ItemForm } from './ItemForm'

describe('ItemForm', () => {
  it('shows a validation error when name is empty', async () => {
    const user = userEvent.setup()
    renderWithStore(<ItemForm />)
    await user.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('submits a valid name and resets the field', async () => {
    const user = userEvent.setup()
    renderWithStore(<ItemForm />)
    const input = screen.getByLabelText(/name/i)
    await user.type(input, 'New item')
    await user.click(screen.getByRole('button', { name: /save/i }))
    // the mutation hits the MSW mock; on success the form resets
    await waitFor(() => expect(input).toHaveValue(''))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps the value and shows an error when the server fails', async () => {
    server.use(http.post('/api/items', () => HttpResponse.json({}, { status: 500 })))
    const user = userEvent.setup()
    renderWithStore(<ItemForm />)
    const input = screen.getByLabelText(/name/i)
    await user.type(input, 'New item')
    await user.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/could not save/i)).toBeInTheDocument()
    expect(input).toHaveValue('New item')
  })
})
