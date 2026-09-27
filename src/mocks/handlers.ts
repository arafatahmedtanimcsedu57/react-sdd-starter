import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { itemSchema, newItemSchema, type Item } from '../features/items/schema'
import { apiBaseUrl } from '../lib/env'

// Fixtures are parsed through the Zod schema so the mock can't drift from the contract.
const seedItems = () => [itemSchema.parse({ id: '1', name: 'Sample item' })]
let items: Item[] = seedItems()

/** Restore the fixtures; called between tests so one test's writes don't leak into the next. */
export function resetMockData() {
  items = seedItems()
}

export const handlers = [
  http.get(`${apiBaseUrl}/items`, () => HttpResponse.json(items)),
  http.post(`${apiBaseUrl}/items`, async ({ request }) => {
    const body = newItemSchema.safeParse(await request.json())
    if (!body.success) return HttpResponse.json(z.flattenError(body.error), { status: 400 })
    const created = itemSchema.parse({ id: String(items.length + 1), ...body.data })
    items.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),
]
