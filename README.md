# React SDD Starter

A ready-to-run React starter with the full agentic, spec-driven pipeline pre-wired:
Vite + React + TypeScript, RTK Query, Zustand, React Hook Form + Zod, MSW, Vitest,
Playwright, react-doctor, OpenSpec, and Claude Code skill/agents/commands/hooks.

Everything in `PIPELINE.md` is already set up in this repo. It's a GitHub **template**:
click "Use this template" to get your own repo (don't push project work back here), then
run `/start` inside `claude` once to personalise it.

## Quick start

Needs Node 22+ (`.nvmrc` pins 24; run `nvm use`).

```bash
npm ci
npx playwright install chromium   # once, for e2e
cp .env.example .env              # VITE_API_MOCKING=enabled → run against MSW mocks
npm run dev                       # http://localhost:5173
npm run check                     # every gate the agent must pass
```

Already set up: OpenSpec, the MSW worker, Claude Code hooks and permissions, pinned react-doctor + prettier.

Human-only setup on GitHub (the agent can't and shouldn't do these):

1. Inside `claude`: `/install-github-app` (adds the `ANTHROPIC_API_KEY` secret).
2. Branch protection: require `CI` + `PR size`, 1 review, and Code Owner review.
3. Put real reviewers in `.github/CODEOWNERS`.
4. Optional: preview deploys per PR; set repo variable `AUTOPILOT_ENABLED=true` for nightly runs.

## Scripts

| Script              | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Vite dev server                                   |
| `npm run build`     | Typecheck + production build                      |
| `npm run check`     | typecheck + lint + format:check + test + doctor   |
| `npm run typecheck` | `tsc --noEmit`                                    |
| `npm run lint`      | ESLint                                            |
| `npm run format`    | Prettier (write)                                  |
| `npm run test`      | Vitest (unit + component)                         |
| `npm run test:e2e`  | Playwright (starts dev server with mocks)         |
| `npm run doctor`    | react-doctor, new issues in changed files only    |
| `npm run gen:api`   | Generate the RTK Query layer from an OpenAPI spec |

## How to use the pipeline

Five commands — that's the whole interface. Claude runs the rest (the `feature-pipeline`
and `openspec-*` skills, the reviewer subagents) behind them; those are hidden from the `/`
menu on purpose. The UI is designed in **Claude Design** on claude.ai, and you can edit it
there yourself at any point.

| Command              | When                                    | What happens                                                                                         |
| -------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/start`             | once, in a repo made from this template | name, styling + UI library, first requirements, **Design System + a screen per feature**             |
| `/feature <idea>`    | every new feature or change             | requirements → reuse its design, or design it in your theme → spec. Then you edit the design         |
| `/build <change>`    | when the design looks right             | re-reads your design edits → **Gate 1** (you say yes) → code → tests + screenshots → PR (**Gate 2**) |
| `/sync-ui [feature]` | after you edit an already-built design  | diffs design vs code; codes visual changes, sends behaviour changes to `/build`                      |
| `/finish <change>`   | after you merge the PR                  | archives the spec into `openspec/specs/`, marks it shipped                                           |

`/build` and `/sync-ui` need a local Claude Code session signed in to claude.ai. The
approved design is also copied into `design/`, which is what CI and autopilot build from.

- **Or just describe it:** asking for a feature in plain words triggers the same pipeline.
- **Where you come in:** see `PIPELINE.md` → "Human involvement" for what each gate asks
  of you and roughly how long it takes.
- **Heads-up:** `openspec update` / `openspec init` regenerates `.claude/commands/opsx/`
  and unhides the `openspec-*` skills. Delete that folder and re-add `user-invocable: false`
  afterwards.

## What's inside

- `CLAUDE.md` — the standing rules: conventions, folder structure, state/data/form rules,
  API-contract policy. Loaded every session.
- `PIPELINE.md` — the full playbook.
- `features.md` / `architecture.md` — human-owned intent and tech decisions (the spec inputs).
- `.claude/` — the `/start`, `/feature`, `/finish` commands; the hidden `feature-pipeline` +
  `openspec-*` skills; `react-reviewer` + `codebase-explorer` subagents; self-correcting
  hooks (`hooks/`), and permissions that block merge / force-push.
- `src/` — the fixed folder structure with a small worked example (an `items` feature that
  exercises RTK Query + Zod response validation, a Zustand UI store, an RHF + Zod form, and
  MSW mocks) plus tests at all three layers.
- `.github/` — CI gate, PR size check, `@claude` on-demand, opt-in autopilot, CODEOWNERS,
  and a PR template that makes the agent list its unasked decisions.

## The API contract (why frontend-first works here)

The contract is a first-class artifact. When an OpenAPI/Swagger spec exists, generate the
RTK Query layer with `npm run gen:api`. When it doesn't, write the contract as Zod schemas
(see `src/features/items/schema.ts`), mock it with MSW (`src/mocks/`), and build the UI
against the mock now — flip mocking off when the real backend ships. RTK Query responses are
validated against the Zod schema at runtime, so a backend that drifts fails loudly.

## Replace the example

The `items` feature is a demonstration. `/start` offers to remove it (the feature folder,
`src/routes/ItemsPage*`, its mock handlers, the e2e smoke check and its `features.md` entry).
To do it by hand, delete those, then build your own with `/feature` — the structure and rules
stay the same.

## Starting without the template

To build the same setup in an empty folder instead: `npm create vite@latest <name> --
--template react-ts`, then copy in `CLAUDE.md`, `PIPELINE.md`, `.claude/`, `.github/`,
`openspec/config.yaml`, the configs (`vite`, `vitest`, `playwright`, `eslint`, `tsconfig`,
`.prettierignore`, `.nvmrc`) and the `package.json` scripts + devDependencies from this repo,
run `npx msw init public/ --save` and `npx openspec init --tools claude`, then `/start`.
