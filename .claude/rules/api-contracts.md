---
paths:
  - 'src/features/*/schema.ts'
  - 'src/features/*/api.ts'
  - 'src/services/**'
  - 'src/mocks/**'
  - 'openapi-config.ts'
---

# API contracts & mocking (fixed rules)

The API contract is a **first-class artifact**. Establish it BEFORE building the data layer or
UI, and never hand-code endpoints from memory. Record its source in `architecture.md`.

Three cases — pick based on what exists:

1. **OpenAPI / Swagger spec exists** → decide per project:
   - Clean, reasonably complete spec → **generate** the RTK Query layer with
     `@rtk-query/codegen-openapi` (typed endpoints + hooks for free). Regenerate with
     `npm run gen:api`. Don't hand-edit the generated file.
   - Partial / messy spec → hand-write the api slice (still fully typed), using the spec as
     reference.
2. **Informal contract** (Postman collection, sample JSON, a written description) → capture it
   as Zod schemas in `src/features/<domain>/schema.ts`. Those become the source of truth.
3. **Frontend-first (API not built yet)** → write the contract FIRST — Zod schemas or an
   OpenAPI stub, whichever exists (if neither, write the Zod schemas). Stand up MSW mocks from
   it and develop + test against the mock. When the real backend ships, disable mocking; if it
   honored the contract, nothing else changes.

## Mocking — MSW (default everywhere)

- MSW is the default mock layer for dev (frontend-first) **and** for component + e2e tests.
- Handlers live in `src/mocks/`, derived from the contract (Zod schemas or OpenAPI).
- Keep mock fixtures valid against the Zod schemas so the mock can't drift from the contract.

## Runtime guard

- Validate RTK Query responses with the Zod schema via `transformResponse`, so a backend that
  drifts from the agreed shape fails loudly instead of silently.
