# React SDD Starter

A ready-to-run React starter with the full agentic, spec-driven pipeline pre-wired:
Vite + React + TypeScript, RTK Query, Zustand, React Hook Form + Zod, MSW, Vitest,
Playwright, react-doctor, OpenSpec, and Claude Code skill/agents/commands/hooks.

Everything in `PIPELINE.md` is already set up in this repo. Clone it, run install, and go.

## Quick start

```bash
npm install
cp .env.example .env            # VITE_API_MOCKING=enabled → run against MSW mocks
npm run dev                     # http://localhost:5173

# one-time, to activate the spec + automation layers:
npx openspec init                               # OpenSpec (pinned as a devDep) — registers slash commands
#   ↑ or use your global install: npm i -g @fission-ai/openspec@latest  then  openspec init
npx react-doctor@latest install --agent-hooks   # wires the reviewer into the edit loop
npx msw init public/ --save                     # generates the MSW worker (if not present)
# from inside `claude` in the repo (optional, for CI + @claude + autopilot):
#   /install-github-app     then turn on branch protection on main
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (unit + component) |
| `npm run test:e2e` | Playwright (starts dev server with mocks) |
| `npm run doctor` | react-doctor health check on changed files |
| `npm run gen:api` | Generate the RTK Query layer from an OpenAPI spec |

## How to use the pipeline

- **New feature (guided):** `/feature describe your change` — walks the spec-driven loop,
  stops at the two gates (review `tasks.md`, review the PR).
- **Or just describe it:** the `feature-pipeline` skill triggers on feature/component work.
- **Bootstrap another project like this:** `/react-project` (interactive, from scratch).

## What's inside

- `CLAUDE.md` — the standing rules: conventions, folder structure, state/data/form rules,
  API-contract policy. Loaded every session.
- `PIPELINE.md` — the full playbook.
- `.claude/` — the `feature-pipeline` skill, `react-reviewer` + `codebase-explorer`
  subagents, `/react-project` + `/feature` commands, and PostToolUse hooks.
- `src/` — the fixed folder structure with a small worked example (an `items` feature that
  exercises RTK Query + Zod response validation, a Zustand UI store, an RHF + Zod form, and
  MSW mocks) plus tests at all three layers.
- `.github/workflows/` — CI gate, `@claude` on-demand, and nightly autopilot.

## The API contract (why frontend-first works here)

The contract is a first-class artifact. When an OpenAPI/Swagger spec exists, generate the
RTK Query layer with `npm run gen:api`. When it doesn't, write the contract as Zod schemas
(see `src/features/items/schema.ts`), mock it with MSW (`src/mocks/`), and build the UI
against the mock now — flip mocking off when the real backend ships. RTK Query responses are
validated against the Zod schema at runtime, so a backend that drifts fails loudly.

## Replace the example

The `items` feature is a demonstration. Delete `src/features/items/` (and its mock handlers)
and build your own feature with `/feature` — the structure and rules stay the same.
