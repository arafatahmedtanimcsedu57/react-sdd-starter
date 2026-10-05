---
paths:
  - 'src/**'
  - 'e2e/**'
---

# Folder structure + placement rules

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
