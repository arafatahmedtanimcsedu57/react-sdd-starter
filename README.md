# React SDD Starter

A React template where **you decide and Claude builds**. You describe a feature, edit its
design in Claude Design, and approve the plan; Claude Code writes the code and tests, then
opens a PR. You review it and merge.

**Stack:** Vite · React 19 · TypeScript (strict) · React Router 7 · RTK Query · Zustand ·
React Hook Form + Zod · Tailwind 4 · MSW · Vitest · Playwright · OpenSpec.

---

## 1. What you need

- **Node 22+** (`.nvmrc` pins 24, so run `nvm use`)
- **Claude Code**, signed in to claude.ai (`claude` in your terminal)
- **Claude Design** access on the same claude.ai account (the UI is designed there)
- A **GitHub** repo made from this template ("Use this template"). Don't push project
  work back to the template itself.

## 2. Set up (once per project)

```bash
npm ci
npx playwright install chromium    # browser for e2e tests
cp .env.example .env               # runs the app against mock data, no backend needed
npm run dev                        # http://localhost:5173
claude                             # then type: /start
```

`/start` asks before each step. It names the project, picks the UI library, removes the
`items` example, writes your first requirements, and creates your Claude Design theme and
screens.

**On GitHub, a repo admin does this once** (Claude can't and shouldn't):

1. In `claude`, run `/install-github-app` (adds the `ANTHROPIC_API_KEY` secret).
2. Branch protection on the default branch: require the `CI` and `PR size` checks, 1
   review, and Code Owner review.
3. Put real people or teams in `.github/CODEOWNERS`.
4. Optional: preview deploys per PR, and the repo variable `AUTOPILOT_ENABLED=true` for
   nightly builds of approved specs.

## 3. Build a feature: the daily loop

You only ever type these six commands in `claude`:

```text
/feature <idea>  →  edit the design  →  /build <change>  →  review + merge PR  →  /finish <change>
```

| Step                 | You do                                                        | Claude does                                                            |
| -------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `/feature <idea>`    | Describe the feature and answer its questions                 | Writes it in `features.md`, designs the screen, writes the spec        |
| Edit the design      | Adjust the screens in Claude Design until they look right     | Nothing, it waits for you                                              |
| `/build <change>`    | **Gate 1:** read the short brief and say "yes"                | Codes it, tests it, checks it against the design, opens a PR           |
| Review the PR        | **Gate 2:** read "Review carefully", click the preview, merge | Fixes anything you comment on (mention `@claude` in the PR)            |
| `/finish <change>`   | Run it after merging                                          | Archives the spec into `openspec/specs/` and marks the feature shipped |
| `/sync-ui [feature]` | Run it after you edit an already-built design                 | Updates the code to match; sends behaviour changes to `/build`         |
| `/fix <bug>`         | Describe the bug and how to reproduce it; review the PR       | Writes a failing test, makes the smallest fix, opens a PR              |

You can also just describe what you want in plain words; Claude follows the same steps.
`PIPELINE.md` → "Human involvement" explains what each gate asks of you.

**Two rules that keep this working:**

- **Claude stops and asks** when copy, empty or error states, the API contract, or a new
  dependency is undecided. Answer the question; don't tell it to "just pick one".
- **One change = one small PR** (≤ 400 reviewable lines, checked in CI). Split big
  features into several `/feature` changes.

## 4. Where things go

Claude follows these rules automatically (they're in `CLAUDE.md`). They're here so you can
read and review the code:

| I want to add…              | It goes in                                                        |
| --------------------------- | ----------------------------------------------------------------- |
| A page                      | `src/routes/<Name>Page.tsx` + one line in `src/routes/routes.tsx` |
| A feature's UI, API, schema | `src/features/<domain>/` (`components/`, `api.ts`, `schema.ts`)   |
| A shared component          | `src/components/` (design-system primitives in `components/ui/`)  |
| A pure helper               | `src/lib/`                                                        |
| A shared hook               | `src/hooks/`                                                      |
| Global client state         | `src/stores/` (Zustand)                                           |
| A mock API response         | `src/mocks/handlers.ts`                                           |
| An env variable             | `src/lib/env.ts` + `src/vite-env.d.ts` + `.env.example`           |
| Colours, fonts, radii       | the `@theme` block in `src/styles/index.css` (from Claude Design) |

Each library has one job: **RTK Query** for server data, **Zustand** for UI state, and
**React Hook Form + Zod** for forms. ESLint blocks imports that point the wrong way (for
example, `lib/` importing from `features/`).

## 5. Talking to a backend

The app starts on **mock data** (MSW), so you can build before the API exists. The
contract is written as Zod schemas, and responses are checked against them at runtime, so
a backend that drifts from the contract fails loudly.

| Setting in `.env`                                                      | What happens                                                           |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `VITE_API_MOCKING=enabled`                                             | Mock data from `src/mocks/` (default)                                  |
| `VITE_API_MOCKING=disabled` + `API_PROXY_TARGET=http://localhost:8080` | Dev server forwards `/api/*` to your backend (no CORS setup)           |
| `VITE_API_URL=https://api.example.com`                                 | Calls that URL directly (deployed builds; the backend must allow CORS) |

- **Auth:** call `useSessionStore.getState().signIn(token)` after login. Every request then
  sends `Authorization: Bearer <token>`, and a `401` response signs the user out. The code
  is in `src/services/baseQuery.ts`.
- **OpenAPI spec available?** Point `openapi-config.ts` at it and run `npm run gen:api`.
  The typed endpoints and hooks go into the same API slice.

## 6. What must pass before a PR can merge

Claude runs these while it works (via hooks), and CI runs them again on every PR:

| Check                  | Command            | Fails when                                                                |
| ---------------------- | ------------------ | ------------------------------------------------------------------------- |
| Types, lint, format    | `npm run check`    | any error, or an import in the wrong direction                            |
| Unit + component tests | (part of `check`)  | a test fails, or coverage drops below the floor in `vitest.config.ts`     |
| React health           | (part of `check`)  | react-doctor finds a new issue in changed files                           |
| Build + bundle budget  | `npm run build`    | the build breaks, or any JS chunk exceeds 180 kB gzipped                  |
| End-to-end + a11y      | `npm run test:e2e` | a key flow breaks, or axe finds an accessibility violation                |
| PR size                | CI only            | over 400 reviewable lines (a human can add the `large-pr-approved` label) |

Dependabot opens grouped dependency-update PRs every week, and each one goes through the
same checks.

## 7. Scripts

| Script                  | What it does                                                  |
| ----------------------- | ------------------------------------------------------------- |
| `npm run dev`           | Dev server on `localhost:5173`                                |
| `npm run build`         | Typecheck + production build + bundle budget                  |
| `npm run preview`       | Serve the production build locally                            |
| `npm run check`         | Every gate: typecheck, lint, format, tests + coverage, doctor |
| `npm run test`          | Unit + component tests (fast, no coverage)                    |
| `npm run test:watch`    | Tests in watch mode                                           |
| `npm run test:coverage` | Tests + coverage report (`coverage/`)                         |
| `npm run test:e2e`      | Playwright (starts the dev server with mocks)                 |
| `npm run format`        | Prettier (write)                                              |
| `npm run gen:api`       | Generate the API layer from an OpenAPI spec                   |

## 8. Project map

| Path                  | What it is                                                             |
| --------------------- | ---------------------------------------------------------------------- |
| `features.md`         | **You own it.** What the app does, in plain words                      |
| `architecture.md`     | **You own it.** Tech decisions, API sources, design links              |
| `CLAUDE.md`           | The rules Claude follows every session                                 |
| `PIPELINE.md`         | The full playbook: phases, gates, who does what                        |
| `openspec/`           | Specs: `changes/` in progress, `specs/` shipped                        |
| `design/`             | Copy of the design as last built (written by `/build`, `/sync-ui`)     |
| `.claude/`            | Commands, skills, reviewer agents, self-checking hooks, permissions    |
| `.github/`            | CI, PR size check, `@claude` bot, autopilot, CODEOWNERS, Dependabot    |
| `src/features/items/` | Worked example: API + Zod + form + mocks + tests (removed by `/start`) |

## Troubleshooting

- **Zod error naming a `VITE_*` variable on startup:** that value in `.env` is wrong. The
  error lists what it expected; valid values are in `.env.example`.
- **Blank data with mocking off:** check `API_PROXY_TARGET` or `VITE_API_URL`, and look in
  the browser's Network tab.
- **Build fails on "Bundle budget":** lazy-load the heavy page or dependency. Raising
  `CHUNK_BUDGET_KB` in `vite.config.ts` is a team decision.
- **Deep links 404 after deploying:** your host must serve `index.html` for unknown paths
  (SPA fallback).
- **After `openspec update` or `openspec init`:** it regenerates `.claude/commands/opsx/`
  and unhides the `openspec-*` skills. Delete that folder and re-add
  `user-invocable: false` to those skills.
