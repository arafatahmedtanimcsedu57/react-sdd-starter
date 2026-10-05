# Project conventions — react-sdd-starter

Authoritative rules for this repo. Claude reads this every session — follow it over habit.
(Project name, and the styling approach + UI library, are set during bootstrap.)
`npm run harness:check` keeps this file under 200 lines: add detail to `.claude/rules/`.

## Hard rules

- Never merge, push to the default branch, or write a Gate 1 `approved:` line yourself.
- Never change a feature's state by hand — only `npm run features` (see Feature list).
- Stay inside the active feature's scope; one feature active at a time (WIP=1).
- "Done" means `npm run check` + the feature's proof command passed — not that it looks done.
- Never disable a test, rule or coverage floor to get green. 3 failed tries → stop and ask.

## Commands

- Dev: `npm run dev` · Build: `npm run build` · Format: `npm run format`
- Typecheck: `npm run typecheck` · Lint: `npm run lint` · Doctor: `npm run doctor`
- Test: `npm run test` · Coverage: `npm run test:coverage` · E2E: `npm run test:e2e`
- Harness: `npm run features` · `npm run progress` · `npm run scope` · `npm run harness:check`
- All gates (definition of done): `npm run check`

Hooks already run prettier + eslint + typecheck after every edit, and the scope check,
related tests + react-doctor before you finish a turn. Their errors come back to you — fix
them, don't work around them.

## Slash commands (the human's only interface)

The human uses exactly six: `/start` (once: set up the project + its Claude Design),
`/feature <idea>` (design + spec, then stop so they can edit the design), `/build
<change-name>` (Gate 1 → code → PR), `/sync-ui [feature]` (code catches up with design
edits), `/finish <change-name>` (after merge: archive the spec), `/fix <bug>` (a bug in
shipped behaviour: failing test → fix → PR, no design or spec step). Every other skill
(`feature-pipeline`, `openspec-*`) is internal — you invoke it; never tell the human to run
it. When a vendored OpenSpec skill says "run `/opsx:propose`", say `/feature`; for
`/opsx:apply`, say `/build <change-name>`; for `/opsx:archive` or `/opsx:sync`, say
`/finish <change-name>`.

## Sessions (clock in / clock out)

Every session starts with no memory. The repo is the memory.

- **Clock in:** `npm run progress` (refreshes and prints the state), then read
  `PROGRESS.md` and `DECISIONS.md`. Continue from "Next step"; don't re-decide anything
  `DECISIONS.md` settles without asking.
- **While working:** a choice between real alternatives → one entry in `DECISIONS.md`
  (what, why, what you rejected).
- **Clock out** (before you stop, even mid-change): `npm run check` green or its failure
  written down; `npm run progress`; update `PROGRESS.md` → Current work, Known issues,
  Next step; no debug code or stray files left; commit on the feature branch.

## Feature list

`features.md` is the human's prose; `features.json` is the machine copy: id, proof command
(`verify`), `scope` (folders it may touch) and state. Every entry in one has its ID in the
other.

- States: `not_started → active → passing`, `active ⇄ blocked`. `passing` is final.
- `npm run features -- start <id>` before coding; only one feature is active (WIP=1).
- `npm run features -- verify <id>` runs `npm run check` + the proof command; only a pass
  moves it to `passing`. Every move is logged in `features.ledger.jsonl`.
- New entry (after the human confirms it in `features.md`): `npm run features -- add --id
F0n --title "…" --verify "<runnable command>" --scope <folders>`. The proof command
  includes the feature's e2e spec when it has a user flow.
- Need a folder outside the scope? Ask the human, then `npm run features -- scope <id>
--add <folder>`.

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

## Folder structure

Fixed layout — `src/` holds `routes/` (pages + `routes.tsx`), `features/<domain>/`,
`components/` (`ui/`), `hooks/`, `lib/`, `services/`, `mocks/`, `stores/`, `types/`,
`styles/`, `test/`; Playwright specs live in `e2e/`. Never invent a new top-level folder or
a parallel one that does the same job. The full tree and placement rules are in
`.claude/rules/folder-structure.md` — read it before creating a file. Import direction is
enforced by ESLint.

## State, data fetching & forms (fixed rules)

Three libraries, three jobs — do not mix them up:

| Concern                      | Library                   | Never use instead                 |
| ---------------------------- | ------------------------- | --------------------------------- |
| Server state / data fetching | **RTK Query**             | raw `fetch`/`axios` in components |
| Client / UI state            | **Zustand**               | Redux slices for UI state         |
| Forms + validation           | **React Hook Form + Zod** | uncontrolled ad-hoc validation    |

- Redux Toolkit exists **only** as the RTK Query API layer; components use the generated
  hooks, with `tagTypes` for cache invalidation.
- Zustand: one small store per concern; **select narrowly** to avoid re-renders.
- Forms: the Zod schema is the single source of truth (`z.infer` for the type).

Code samples for each live in `.claude/rules/` (`rtk-query.md`, `zustand.md`, `forms.md`,
`msw.md`) and load when you open a matching file. Read the matching one before creating
the first file of that kind.

## API contracts & mocking (fixed rules)

The API contract is a first-class artifact: establish it BEFORE the data layer or UI, never
hand-code endpoints from memory, and record its source in `architecture.md`. MSW is the
default mock layer for dev and tests; RTK Query responses are validated with the Zod schema
in `transformResponse`. The three cases (OpenAPI / informal / frontend-first) and the
mocking rules are in `.claude/rules/api-contracts.md`.

## Testing (details in the feature-pipeline skill)

- Unit for pure logic; component tests via Testing Library (query by label/role);
  Playwright for every feature's user flow (`e2e/<feature>.spec.ts`).
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
npm run check                      # typecheck + lint + format + harness + coverage + doctor
npm run features -- verify <id>    # check + the feature's proof command → passing
npm run build                      # when adding dependencies or pages — bundle budget
```

`react-reviewer` must return `VERDICT: PASS` before you open a PR. The bundle budget
(`CHUNK_BUDGET_KB` in `vite.config.ts`) fails the build when a JS chunk grows too big — fix
it with lazy loading or a lighter dependency; raising it is a human call.

## Hard rules (again — they matter most)

No merging, no pushing to the default branch, no self-written approval. Feature states only
via `npm run features`. One active feature, inside its scope. Done = commands passed. Never
weaken a check to get green; after 3 failed tries, stop and ask.
