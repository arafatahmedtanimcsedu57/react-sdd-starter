# Project conventions — react-sdd-starter

Authoritative rules for this repo. Claude reads this every session — follow it over habit.
(Project name, and the styling approach + UI library, are set during bootstrap.)

## Commands

- Dev: npm run dev
- Build: npm run build
- Typecheck: npm run typecheck
- Lint: npm run lint
- Test: npm run test
- E2E: npm run test:e2e
- Doctor: npm run doctor
- Format: npm run format
- Coverage: npm run test:coverage
- All gates (definition of done): npm run check

Hooks already run prettier + eslint + typecheck after every edit, and related tests +
react-doctor before you finish a turn. Their errors come back to you — fix them, don't
work around them.

## Slash commands (the human's only interface)

The human uses exactly six: `/start` (once: set up the project + its Claude Design),
`/feature <idea>` (design + spec, then stop so they can edit the design), `/build
<change-name>` (Gate 1 → code → PR), `/sync-ui [feature]` (code catches up with design
edits), `/finish <change-name>` (after merge: archive the spec), `/fix <bug>` (a bug in
shipped behaviour: failing test → fix → PR, no design or spec step). Every other skill (`feature-pipeline`, `openspec-*`) is internal —
you invoke it; never tell the human to run it. When a vendored OpenSpec skill says "run
`/opsx:propose`", say `/feature`; for `/opsx:apply`, say `/build <change-name>`; for `/opsx:archive` or
`/opsx:sync`, say `/finish <change-name>`.

## UI design (Claude Design)

- Claude Design on claude.ai is the source of truth for the UI; links in `architecture.md`
  → Design. Rules: `.claude/skills/feature-pipeline/claude-design.md`.
- `design/` is the copy of the design as last built. Only `/build` and `/sync-ui` write it;
  never hand-edit it.
- Colours, fonts and radii come from design tokens, never hex values copied into components.

## Human in the loop

A person owns intent, decisions and merges. You own execution. Act, but know when to stop.

**Stop and ask — never guess — when:**

- the spec / `features.md` doesn't settle a product or UX behaviour (copy, empty/error
  states, what happens on edge cases)
- a change touches the API contract (a Zod schema, an endpoint, a response shape)
- you want a new dependency, or to change `architecture.md`, `CLAUDE.md`, CI or hooks
- you'd delete or rewrite code outside the change's scope
- the same check fails 3 times and you don't know why

Ask one concrete question with your recommended answer, so the human can reply "yes".

**Risk tiers** (set in every `proposal.md`; decides how much human attention it needs):

| Tier   | Examples                                          | Human involvement                          |
| ------ | ------------------------------------------------- | ------------------------------------------ |
| low    | copy, styling, a test, a small isolated component | Gate 2 only; skim is fine                  |
| medium | new feature UI, state logic, a new dependency     | Gate 1 + Gate 2 with preview click-through |
| high   | contract/schema, auth, money, data deletion, CI   | Gate 1 + Gate 2 + a second reviewer        |

**Gates:**

- Gate 1 — the human approves `tasks.md`. Approval is only real when **they** say so; you
  then write `approved: <their name>, <date>` as the last line of `tasks.md`. Never write
  it on your own initiative. Autopilot only builds changes that carry this line.
- Gate 2 — the human reviews the PR + preview and merges. You never merge or push to the
  default branch (both are blocked in `.claude/settings.json`).
- While waiting at a gate, don't start the next step. Say what you're waiting for and what
  the human needs to decide, in one or two lines.

**Learn from corrections:** if a human corrects the same kind of thing twice, propose a
one-line rule for this file. Don't add it until they agree.

## Component conventions

- Function components only; named exports (no default exports)
- One component per file; colocate `<Component>.test.tsx`
- Props typed with an explicit `<Component>Props` interface
- Data fetching lives in hooks, never inline in components
- Styling + UI library: as recorded in `architecture.md`
- Place every file according to **Folder structure** below

## Folder structure

Fixed layout. Put new files where they belong — do not invent new top-level folders or
rename these.

```
src/
├── main.tsx              # entry — wraps <App/> in <Provider store={store}>
├── App.tsx               # app shell — mounts the router
├── store.ts              # RTK Query store (configureStore)
├── routes/               # routes.tsx (the route table) + one page component per route,
│                         #   RootLayout, RouteError (error boundary + 404), RouteLoading
├── features/             # feature-scoped code — one folder per domain
│   └── <feature>/
│       ├── components/   #   feature UI + colocated *.test.tsx
│       ├── api.ts        #   RTK Query endpoints (injected into services/api)
│       ├── store.ts      #   feature Zustand store (only if needed)
│       ├── schema.ts     #   Zod schemas for this feature
│       └── types.ts      #   feature-local types
├── components/           # shared, reusable UI + colocated tests
│   └── ui/               #   design-system primitives (shadcn / MUI wrappers)
├── hooks/                # shared reusable hooks (use*)
├── lib/                  # pure logic + utilities + colocated tests
│   └── env.ts            #   validated VITE_* env (the only place that reads import.meta.env)
├── services/             # RTK Query: the one api slice + shared query code
│   ├── api.ts            #   createApi — every endpoint injects into this
│   └── baseQuery.ts      #   base URL, auth header, 401 → sign out
├── mocks/                # MSW handlers + browser/node servers (from the API contract)
├── stores/               # shared / global Zustand stores (useSessionStore = auth token)
├── types/                # shared TS types
├── styles/               # global styles / tokens
└── test/setup.ts         # test setup
e2e/                      # Playwright specs
design/                   # copy of the Claude Design as last built (written by /build, /sync-ui)
```

Placement rules:

- Pure function → `src/lib/`. Shared hook → `src/hooks/`. Shared type → `src/types/`.
- Anything specific to one domain → `src/features/<domain>/` (its components, endpoints,
  Zustand store, Zod schema, and types live together).
- RTK Query base slice → `src/services/api.ts`; feature endpoints inject into it from
  `src/features/<domain>/api.ts`.
- Reusable UI → `src/components/` (`components/ui/` for primitives); pages → `src/routes/`.
- Tests are colocated next to the file they test; only Playwright specs live in `e2e/`.
- New page → `src/routes/<Name>Page.tsx` + one entry in `src/routes/routes.tsx` (lazy-loaded).
- New env variable → `src/lib/env.ts` (Zod) + `src/vite-env.d.ts` + `.env.example`. Never
  read `import.meta.env` anywhere else.
- Import direction is enforced by ESLint: `lib/` + `types/` import no app layer;
  `components/`, `hooks/`, `stores/`, `services/` never import `features/` or `routes/`;
  `features/` never imports `routes/`. A feature doesn't reach into another feature's
  `components/` — move shared pieces up to `src/components/` or `src/lib/`.
- Small apps may start with just the top-level folders and add `features/<domain>/` as they
  grow — keep these names; never add a parallel folder that does the same job.

## State, data fetching & forms (fixed rules)

Three libraries, three jobs — do not mix them up:

| Concern                      | Library                   | Never use instead                 |
| ---------------------------- | ------------------------- | --------------------------------- |
| Server state / data fetching | **RTK Query**             | raw `fetch`/`axios` in components |
| Client / UI state            | **Zustand**               | Redux slices for UI state         |
| Forms + validation           | **React Hook Form + Zod** | uncontrolled ad-hoc validation    |

Code samples for each (api slice + endpoints, codegen config, response guard, Zustand store,
form, MSW handlers) live in `.claude/rules/` and load when you open a matching file. Read the
matching one before creating the first file of that kind.

### Server state + data fetching — RTK Query

- All server data goes through RTK Query (from `@reduxjs/toolkit`). No raw `fetch`/`axios`
  in components or hooks.
- Define endpoints in an api slice; use `tagTypes` for cache invalidation; components
  consume the generated hooks (`useGetXQuery`, `useAddXMutation`).
- Redux Toolkit exists in this project **only** as the RTK Query API layer.
- If an OpenAPI/Swagger spec exists, prefer generating this layer — see **API contracts &
  mocking** below.

### Client / UI state — Zustand

- Local and cross-component client state (UI toggles, filters, wizard steps, selected rows)
  lives in Zustand stores — not Redux.
- One store per concern; keep stores small; **select narrowly** to avoid re-renders.

### Forms + validation — React Hook Form + Zod

- Every form uses `react-hook-form` with a Zod schema via `@hookform/resolvers/zod`.
- The Zod schema is the single source of truth; infer the TS type from it with `z.infer`.
- Reuse Zod schemas to validate RTK Query request/response payloads where it adds safety.

## API contracts & mocking (fixed rules)

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

### Mocking — MSW (default everywhere)

- MSW is the default mock layer for dev (frontend-first) **and** for component + e2e tests.
- Handlers live in `src/mocks/`, derived from the contract (Zod schemas or OpenAPI).
- Keep mock fixtures valid against the Zod schemas so the mock can't drift from the contract.

### Runtime guard

- Validate RTK Query responses with the Zod schema via `transformResponse`, so a backend that
  drifts from the agreed shape fails loudly instead of silently.

## Testing (details in the feature-pipeline skill)

- Unit for pure logic; component tests via Testing Library (query by label/role);
  Playwright for the key flow.
- **MSW is the default mock layer** for component + e2e tests. The node server is started in
  `src/test/setup.ts` (`listen` / `resetHandlers` / `close`); for e2e, run the dev server with
  mocking enabled or hit a real backend when one exists.
- Test Zustand stores as plain functions; test Zod schemas directly for edge cases.
- Helpers in `src/test/render.tsx`: `renderWithStore(ui)` for a component, `renderRoute(path)`
  for a whole page through the router. MSW handlers use `apiBaseUrl` from `src/lib/env.ts`.
- Coverage floors live in `vitest.config.ts`. Raise them as the suite grows; never lower
  them to get green.

## Pull requests (fixed rules)

- One OpenSpec change = one PR. Max **400 reviewable lines** per PR — enforced by
  `.github/workflows/pr-size.yml` (tests, mocks, `openspec/`, lockfiles and generated code
  are excluded). Over the limit → split into smaller changes; don't grow the PR.
- Every PR fills in `.github/pull_request_template.md`, including "Review carefully" (risky
  lines + why) and "Safe to skim".
- The `large-pr-approved` label bypasses the size check. Only the human adds it.

## Definition of done (self-check ALL before stopping)

```
npm run check        # typecheck + lint + format:check + test:coverage + doctor
npm run build        # when adding dependencies or pages — enforces the bundle budget
npm run test:e2e     # when the change touches a user flow
```

The bundle budget (`CHUNK_BUDGET_KB` in `vite.config.ts`) fails the build when a JS chunk
grows too big. Fix it with lazy loading or a lighter dependency; raising it is a human call.
