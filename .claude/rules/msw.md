---
paths:
  - 'src/mocks/**'
  - 'src/test/**'
  - 'e2e/**'
  - '**/*.test.ts'
  - '**/*.test.tsx'
---

# MSW mocks — code pattern

Rules are in `CLAUDE.md` → API contracts & mocking, and Testing.

```ts
// mocks from the contract:  src/mocks/handlers.ts
import { http, HttpResponse } from 'msw'
import { itemSchema } from '../features/items/schema'
import { apiBaseUrl } from '../lib/env'
const items = [itemSchema.parse({ id: '1', name: 'Example' })] // fixture must satisfy the schema
export const handlers = [http.get(`${apiBaseUrl}/items`, () => HttpResponse.json(items))]
// src/mocks/browser.ts  → setupWorker(...handlers)   (dev / frontend-first)
// src/mocks/server.ts   → setupServer(...handlers)   (tests)
```
