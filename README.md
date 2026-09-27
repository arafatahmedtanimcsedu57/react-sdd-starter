# React SDD Starter

A ready-to-run React starter with the full agentic, spec-driven pipeline pre-wired:
Vite + React + TypeScript, RTK Query, Zustand, React Hook Form + Zod, MSW, Vitest,
Playwright, react-doctor, OpenSpec, and Claude Code skill/agents/commands/hooks.

Everything in `PIPELINE.md` is already set up in this repo. Clone it, run install, and go.

## Quick start

Needs Node 22+ (`.nvmrc` pins 24; run `nvm use`).

```bash
npm ci
npx playwright install chromium   # once, for e2e
cp .env.example .env              # VITE_API_MOCKING=enabled → run against MSW mocks
npm run dev                       # http://localhost:5173
npm run check                     # every gate the agent must pass
```

Already set up: OpenSpec (`/opsx:propose`, `/opsx:apply`, `/opsx:archive`), the MSW
worker, Claude Code hooks and permissions, pinned react-doctor + prettier.

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

- **New feature (guided):** `/feature describe your change` — walks the spec-driven loop,
  stops at the two gates (a one-screen Gate 1 brief, then the PR).
- **Where you come in:** see `PIPELINE.md` → "Human involvement" for what each gate asks
  of you and roughly how long it takes.
- **Or just describe it:** the `feature-pipeline` skill triggers on feature/component work.
- **Bootstrap another project like this:** `/react-project` (interactive, from scratch).
- **Terser replies (opt-in):** `/caveman` (or `/caveman lite|ultra`) makes Claude's chat
  replies short; `stop caveman` reverts. Code, commits, PRs, OpenSpec docs and gate
  questions stay in normal prose. Vendored from
  [caveman](https://github.com/JuliusBrussee/caveman) (MIT). Its optional token-saving proxy
  is a per-machine install (`npm i -g @caveman-ai/cli`, BSL-1.1, telemetry on by default) —
  not part of this repo.

## What's inside

- `CLAUDE.md` — the standing rules: conventions, folder structure, state/data/form rules,
  API-contract policy. Loaded every session.
- `PIPELINE.md` — the full playbook.
- `features.md` / `architecture.md` — human-owned intent and tech decisions (the spec inputs).
- `.claude/` — the `feature-pipeline` and opt-in `caveman` skills, `react-reviewer` + `codebase-explorer`
  subagents, `/react-project` + `/feature` commands, OpenSpec's `/opsx:*`, self-correcting
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

The `items` feature is a demonstration. Delete `src/features/items/`, `src/routes/ItemsPage*`,
its mock handlers and its `features.md` entry, then build your own with `/feature` — the
structure and rules stay the same.
