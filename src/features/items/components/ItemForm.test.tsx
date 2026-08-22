import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { store } from '../../../store'
import { ItemForm } from './ItemForm'

function renderForm() {
  return render(
    <Provider store={store}>
      <ItemForm />
    </Provider>,
  )
}

describe('ItemForm', () => {
  it('shows a validation error when name is empty', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('submits a valid name and resets the field', async () => {
    const user = userEvent.setup()
    renderForm()
    const input = screen.getByLabelText(/name/i)
    await user.type(input, 'New item')
    await user.click(screen.getByRole('button', { name: /save/i }))
    // the mutation hits the MSW mock; on success the form resets
    await waitFor(() => expect(input).toHaveValue(''))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
