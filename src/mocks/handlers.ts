import { http, HttpResponse } from 'msw'
import { itemSchema } from '../features/items/schema'

// Fixtures are parsed through the Zod schema so the mock can't drift from the contract.
const items = [itemSchema.parse({ id: '1', name: 'Sample item' })]

export const handlers = [
  http.get('/api/items', () => HttpResponse.json(items)),
  http.post('/api/items', async ({ request }) => {
    const body = (await request.json()) as { name: string }
    const created = itemSchema.parse({ id: String(items.length + 1), name: body.name })
    items.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),
]
