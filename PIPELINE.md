# Agentic Development Pipeline

An end-to-end, spec-driven, self-correcting pipeline for building **any** React
(Vite + TypeScript) app with Claude Code, deployed on Vercel. It combines a human-owned
planning workflow with automated execution and enforcement. Drop the accompanying `.claude/`
folder and `CLAUDE.md` into any React repo to use it.

## The one principle everything rests on

Automation does not remove the human gate — it **relocates it to the pull request**.
Everything upstream of the PR can be automated aggressively, because nothing reaches `main`
(or production) until CI is green _and_ a human approves the PR.

---

## The flow at a glance

```
DEFINE            plan mode → features.md
                  decide tech + design tokens → architecture.md
DESIGN            UI design skill → html/css mockup  (visual target)
SPEC              OpenSpec propose → proposal / spec / tasks.md
   ★ GATE 1       you review tasks.md              (cheapest place to fix intent)
IMPLEMENT LOOP    /clear → OpenSpec apply → implement
   ↻ self-correct   PostToolUse hooks: prettier + typecheck
                     react-doctor agent-hooks feed findings back
                     tests run at the done-gate
VERIFY            CI: typecheck · lint · unit · e2e · react-doctor --diff
SHIP              Vercel preview deploy per PR
   ★ GATE 2       you review the PR + preview URL
                  merge → prod deploy → OpenSpec archive → living specs
```

Ownership: **you drive** DEFINE and both gates; **the agent runs** DESIGN, SPEC, IMPLEMENT;
**the machine enforces** VERIFY.

---

## Repository layout

The fixed folder structure (authoritative copy lives in `CLAUDE.md`):

```
<project>/
├── CLAUDE.md                     # always-loaded backbone: commands + conventions + rules + structure
├── features.md                   # human: what we're building
├── architecture.md               # human: tech decisions + design tokens + styling/UI choice
├── openspec/
│   ├── specs/                    # source of truth (living specs)
│   └── changes/                  # proposals: proposal.md, design.md, tasks.md
├── .claude/
│   ├── settings.json             # PostToolUse hooks (prettier + typecheck)
│   ├── skills/feature-pipeline/  # the workflow skill
│   ├── agents/                   # react-reviewer, codebase-explorer
│   └── commands/                 # /react-project, /feature
├── .github/workflows/            # ci.yml, claude.yml, autopilot.yml
├── e2e/                          # Playwright specs
└── src/
    ├── main.tsx, App.tsx, store.ts
    ├── routes/                   # pages
    ├── features/<domain>/        # feature-scoped: components, api.ts, store.ts, schema.ts, types.ts
    ├── components/ (ui/)         # shared UI + colocated tests
    ├── hooks/  lib/  services/  stores/  types/  styles/
    └── test/setup.ts
```

---

## Phase 0 — One-time setup (per repo)

```bash
npx @fission-ai/openspec@latest init                        # spec-driven layer + slash commands
npx react-doctor@latest install --agent-hooks   # automated reviewer, wired into the edit loop
npm i @reduxjs/toolkit react-redux zustand      # state + data (standing rule)
npm i react-hook-form zod @hookform/resolvers   # forms + validation (standing rule)
npm i -D msw && npx msw init public/ --save     # mock layer (dev + tests)
npm i -D vitest @vitejs/plugin-react jsdom \
        @testing-library/react @testing-library/jest-dom @testing-library/user-event \
        @playwright/test
npx playwright install
# From inside `claude` in the repo:  /install-github-app
```

Then enable **branch protection** on `main` (require the `CI` check + 1 review), and connect
the repo to Vercel (preview deploy per PR; production from `main`).

---

## Phase 1 — Define (you drive)

1. In **plan mode**, talk through the feature. No code yet.
2. Capture user-facing behaviour, states, and edge cases in `features.md`.
3. Record tech decisions, design tokens, and the styling approach + UI library in
   `architecture.md`.
4. **Establish the API contract** before the data layer or UI. Three cases (details in
   `CLAUDE.md`): an OpenAPI/Swagger spec exists → generate the RTK Query layer (or hand-write
   if messy); an informal contract → capture it as Zod schemas; frontend-first with no API yet
   → write the contract first and mock it with MSW so the UI never blocks on the backend.

Keep `features.md` / `architecture.md` as the _human inputs to OpenSpec_ — don't hand-maintain
a parallel spec.

## Phase 2 — Design (agent runs)

Use the frontend UI design skill to generate an **HTML/CSS mockup** from `features.md` + the
tokens in `architecture.md`. This is the visual target — the agent is blind to rendered UI.

## Phase 3 — Spec + Gate 1 (agent runs → you review)

1. Run OpenSpec **propose** → `proposal.md`, delta specs, `design.md`, `tasks.md`.
2. **★ GATE 1 — review `tasks.md` before implementing.** Cheapest place to fix intent — and
   the place to control PR size. One change = one PR, max 400 reviewable lines; anything
   bigger gets split into several changes here (e.g. contract → UI → wiring).

## Phase 4 — Implement loop (agent runs, self-correcting)

1. `/clear` (implement against the spec file, not a bloated transcript).
2. Run OpenSpec **apply**. Work down `tasks.md`, placing files per the folder structure.
3. Self-correction on each edit: hooks run prettier + typecheck; react-doctor's agent-hook
   feeds findings back. Write tests as you go.

**Definition of done** (in `CLAUDE.md`, run before any task is finished):

```
npm run typecheck && npm run lint && npm run test && npm run doctor
```

## Phase 5 — Verify + Ship + Gate 2

1. Agent opens a PR (manually, via `@claude`, or via autopilot).
2. **CI gate** runs: typecheck, lint, unit + component tests, e2e, `react-doctor --diff <base branch>`,
   plus the **PR size check** (`pr-size.yml`, 400 reviewable lines; the `large-pr-approved`
   label bypasses it). The PR body follows `.github/pull_request_template.md` so the reviewer
   knows what to read closely and what to skim.
3. Vercel posts a **preview URL** — eyeball it (closes the visual gap).
4. **★ GATE 2 — review the PR + preview**, then merge.
5. Run OpenSpec **archive** to fold the change into living specs.

---

## The two automation layers

**Enforcement (CI/CD)** — `ci.yml` is the machine that catches mistakes; it must exist before
anything autonomous writes code. Nothing merges red.

**Execution (autonomous agent)** — `anthropics/claude-code-action@v1` turns work into PRs:

- **On-demand:** mention `@claude` on an issue → it branches, implements, tests, opens a PR.
- **Scheduled:** a cron job picks the next `openspec/changes/` folder and opens a PR unattended.
  It reads `CLAUDE.md` every run, so conventions apply automatically.
- **Own hardware:** point the job at a self-hosted runner instead of `ubuntu-latest` to run on
  your own machine.

Every autonomous PR still lands at Gate 2.

---

## Configuration reference

### CLAUDE.md

Ships in this bundle. Holds the commands, component conventions, the fixed folder structure,
and the standing rules (RTK Query for server state, Zustand for client state, React Hook Form

- Zod for forms). Fill in the project name and set the styling/UI line at bootstrap.

### .claude/settings.json

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npx prettier --write $CLAUDE_FILE_PATHS"
          },
          { "type": "command", "command": "npm run typecheck" }
        ]
      }
    ]
  }
}
```

react-doctor manages its own agent-hook (wired by `install --agent-hooks`).

### package.json (scripts)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "doctor": "npx -y react-doctor@latest --verbose --scope changed"
  }
}
```

### vitest.config.ts + src/test/setup.ts

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
```

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '../mocks/server' // MSW — default mock layer

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
})
afterAll(() => server.close())
```

### Testing standard — three layers (generic examples; adapt to your domain)

```ts
// src/lib/math.ts  — unit: pure logic, fastest, highest value
export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}
```

```ts
// src/lib/math.test.ts
import { describe, it, expect } from 'vitest'
import { sum } from './math'

describe('sum', () => {
  it('is 0 for an empty list', () => expect(sum([])).toBe(0))
  it('adds the values', () => expect(sum([2, 3, 5])).toBe(10))
})
```

```tsx
// src/components/ExampleForm.test.tsx  — component: behaviour + a11y via interaction
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExampleForm } from './ExampleForm'

describe('ExampleForm', () => {
  it('submits a valid value', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<ExampleForm onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText(/name/i), 'Ada')
    await user.click(screen.getByRole('button', { name: /save/i }))
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Ada' })
  })

  it('shows an error on empty input', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<ExampleForm onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: /save/i }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
```

```ts
// e2e/smoke.spec.ts  — e2e: the key user flow (this verifies the rendered UI)
import { test, expect } from '@playwright/test'

test('user completes the primary flow', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel(/name/i).fill('Ada')
  await page.getByRole('button', { name: /save/i }).click()
  await expect(page.getByText(/saved/i)).toBeVisible()
})
```

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5173' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
```

For the RTK Query, Zustand, and React Hook Form + Zod patterns, see `CLAUDE.md` — those are
the canonical, always-loaded examples.

### .github/workflows/ci.yml — the enforcement gate

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main, master]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # react-doctor --diff needs base branch history
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
      - name: React health gate
        env:
          BASE_REF: ${{ github.base_ref || github.event.repository.default_branch }}
        run: npx -y react-doctor@latest . --diff "origin/$BASE_REF" --score
```

### .github/workflows/claude.yml — on-demand executor

Generated by `/install-github-app`; responds to `@claude` on issues and PRs.

```yaml
name: Claude
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  issues:
    types: [opened, assigned]

jobs:
  claude:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### .github/workflows/autopilot.yml — scheduled spec → PR

```yaml
name: Autopilot
on:
  schedule:
    - cron: '0 2 * * *' # nightly
  workflow_dispatch:

jobs:
  build-next-spec:
    runs-on: ubuntu-latest # or a self-hosted runner
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            Pick the highest-priority change folder in openspec/changes/.
            Implement it on a new branch following tasks.md and CLAUDE.md.
            Run: npm run typecheck && npm run lint && npm run test && npm run doctor.
            Fix anything that fails, then open a PR. Do NOT merge.
```

---

## Guardrails

- **Branch protection is non-negotiable.** Require the CI check + 1 review on `main`.
- **Context hygiene.** `/clear` before implementation.
- **react-doctor scores are heuristic** — treat a drop as "look here," not "auto-block."
  Real tests verify behaviour; react-doctor verifies smell. (Dead-code detection was dropped
  in v0.2 — run `npx knip` separately if you want it.)
- **Cost.** The agent consumes API tokens + Actions minutes; set limits. `--diff main` keeps
  react-doctor from failing on legacy issues.
- **Fork security.** On fork PRs the default `pull_request` event can't read
  `ANTHROPIC_API_KEY` (safe). Never use `pull_request_target` with untrusted fork code.

---

## Daily loop (the TL;DR)

1. Plan-mode chat → update `features.md` / `architecture.md`.
2. OpenSpec **propose** → **review `tasks.md`** (Gate 1).
3. `/clear` → OpenSpec **apply** → agent implements; hooks + react-doctor + tests self-correct.
4. PR opens → CI runs → Vercel preview appears.
5. **Review PR + preview** (Gate 2) → merge → OpenSpec **archive**.

Two gates, everything else automated.
