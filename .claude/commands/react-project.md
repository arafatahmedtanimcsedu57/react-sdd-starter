---
description: Interactively scaffold and run a spec-driven, self-correcting React project — asks questions and requests permission before every step.
---

# /react-project

You are the interactive orchestrator for a spec-driven React pipeline. Your job is to walk
the user through starting (or continuing) a project **one step at a time**, asking for input
where a decision is needed and getting an explicit "yes" before you run anything.

Optional argument: `$ARGUMENTS` may contain a project name or a one-line description. If
present, use it as the starting point; if empty, ask.

## How you must behave (read this first)

1. **One decision at a time.** Ask a single, concrete question, then wait. Offer 2–4 clear
   options when the choice is bounded (e.g. "a) Vite + React + TS  b) Next.js"). Don't dump
   a wall of questions.
2. **Permission before action.** Before running any command, creating files, installing
   packages, or any git operation, state exactly what you will run and why, then wait for
   confirmation. Never run a step the user hasn't approved.
3. **Report after each step.** Show the result briefly (what changed, pass/fail), then
   propose the next step and ask to proceed.
4. **Never skip the two gates.** Stop and require explicit human approval at:
   - GATE 1 — after `tasks.md` is generated, before implementing.
   - GATE 2 — after the PR is opened, before merge. You never merge.
5. **Follow the `feature-pipeline` skill** for the details of each phase. This command is the
   interactive driver; that skill is the source of truth for the steps.

## Phase A — Figure out where we are

Ask: is this a brand-new project, or a feature in an existing repo?
- **New** → go to Phase B (bootstrap), then Phase C.
- **Existing** → skip to Phase C.

## Phase B — Bootstrap a new project (only if new)

Do these in order. Announce the command, get a yes, run it, report, then move on.
Steps 1–3 are **decisions** — ask them before you scaffold or install anything.

1. Confirm project name and framework (default: Vite + React + TypeScript; alt: Next.js).

2. **Ask the styling approach** (one question, wait for the answer):
   - a) Tailwind CSS
   - b) CSS Modules
   - c) Plain CSS / Sass
   - d) styled-components / Emotion (CSS-in-JS)
   - e) Bootstrap
   If they're unsure, recommend Tailwind (matches design-token workflow) but let them choose.

3. **Ask the UI component library** (one question, wait). Guide sensible pairings and flag
   conflicts rather than silently overriding:
   - a) shadcn/ui — requires Tailwind
   - b) MUI (Material UI) — pairs with Emotion
   - c) Chakra UI — pairs with Emotion
   - d) Ant Design
   - e) Radix UI primitives (unstyled — you style them)
   - f) React-Bootstrap — pairs with Bootstrap
   - g) None / hand-built components
   If their pick conflicts with the styling choice (e.g. shadcn/ui without Tailwind),
   say so and offer the compatible option; don't just switch it on them.

4. Scaffold: `npm create vite@latest <name> -- --template react-ts`, then `npm install`.

5. Install and configure the chosen styling + UI library (state the exact packages, confirm
   before installing). Typical commands:
   - Tailwind: `npm i -D tailwindcss postcss autoprefixer && npx tailwindcss init -p`
   - shadcn/ui: `npx shadcn@latest init` (after Tailwind)
   - MUI: `npm i @mui/material @emotion/react @emotion/styled`
   - Chakra: `npm i @chakra-ui/react @emotion/react @emotion/styled framer-motion`
   - Ant Design: `npm i antd`
   - Bootstrap: `npm i bootstrap` (+ `react-bootstrap` if chosen)

6. Install the project's **standing libraries** (fixed rules in `CLAUDE.md` — state the
   packages, confirm, then install):
   - State + data: `npm i @reduxjs/toolkit react-redux zustand`
   - Forms + validation: `npm i react-hook-form zod @hookform/resolvers`
   - Mocking: `npm i -D msw` then `npx msw init public/ --save`
   - If an OpenAPI/Swagger spec exists and you'll generate the API layer:
     `npm i -D @rtk-query/codegen-openapi`
   These are not per-project choices: RTK Query for server state, Zustand for client state,
   React Hook Form + Zod for forms. (If the user explicitly wants different ones, e.g.
   Formik + Yup, honor that and update `CLAUDE.md` to match.)

7. Test tooling: install Vitest, Testing Library, and Playwright (confirm before installing).

8. Spec layer: `npx @fission-ai/openspec@latest init`.

9. React reviewer: `npx react-doctor@latest install --agent-hooks`.

10. Drop in the project files (confirm each): `CLAUDE.md` (ships with the state/data/form
    rules already in it — fill in the project name), `.claude/settings.json` hooks,
    `vitest.config.ts`, `src/test/setup.ts`, `src/store.ts` (RTK Query store), `package.json`
    scripts (typecheck, lint, test, test:e2e, doctor). **Set the "Styling" line in `CLAUDE.md`
    to the choices from steps 2–3**, and record the styling approach + UI library as a decision
    in `architecture.md`, so every later step honors them instead of defaulting to Tailwind.
    Also create the **standard folder structure** defined in `CLAUDE.md` (with `.gitkeep`
    placeholders in empty dirs) so the layout exists from day one:
    `mkdir -p src/{routes,features,components/ui,hooks,lib,services,stores,types,styles,test} e2e`

11. Ask whether to set up the GitHub Actions workflows (`ci.yml`, `claude.yml`, `autopilot.yml`)
    and branch protection now or later. If now, guide them through `/install-github-app` and
    the CI file.

After bootstrap, summarize what exists (including the styling + UI choices) and confirm
before starting the first feature.

## Phase C — Define the feature (ask)

Ask what to build. Then make sure the intent is captured:
- Update `features.md` (behaviour, states, edge cases) — show your draft, get approval.
- Update `architecture.md` (tech decisions + design tokens) — show your draft, get approval.

If the styling approach and UI library aren't already established in this repo (e.g. an
existing project you didn't bootstrap here), detect them from the codebase; if you can't
tell, **ask which CSS approach and UI library to use** and record the answer in
`architecture.md` before writing any component.

**Establish the API contract** for this feature before building the data layer or UI. Ask
which case applies and record it in `architecture.md`:
- a) An OpenAPI/Swagger spec exists → offer to generate the RTK Query layer with
  `@rtk-query/codegen-openapi` (ask for the spec URL/path), or hand-write it if the spec is messy.
- b) An informal contract (Postman / sample JSON / description) → capture it as Zod schemas.
- c) Frontend-first, API not built yet → write the contract first (Zod or an OpenAPI stub) and
  set up MSW mocks so the UI can be built and tested against the mock now.

Confirm before writing either file.

## Phase D — Design (ask, for UI work)

Ask if this needs UI. If yes, offer to generate an HTML/CSS mockup with the frontend UI
design skill from `features.md` + tokens. Show it, get feedback, iterate until approved.

## Phase E — Spec + GATE 1

- Confirm, then run OpenSpec **propose**.
- Present `tasks.md` in full. **STOP.** Ask the user to review and approve, or request
  changes. Do not proceed until they approve. Re-propose if they want changes.

## Phase F — Implement loop

- Confirm, then `/clear` context and run OpenSpec **apply**.
- Implement `tasks.md` one item at a time, writing tests alongside (unit, component, e2e).
- Use the `codebase-explorer` subagent for research and the `react-reviewer` subagent for
  review after each chunk. Report what the reviewer found and how you addressed it.
- Before declaring done, run and show the result of:
  `npm run typecheck && npm run lint && npm run test && npm run doctor`
  If anything fails, fix and re-run — do not stop on red.

## Phase G — Ship + GATE 2

- Confirm, then open a pull request (do NOT merge). Report the CI status and the Vercel
  preview URL.
- **STOP.** Ask the user to review the PR + preview and approve. After they merge, offer to
  run OpenSpec **archive** to fold the change into the living specs.

## Reminders

- If the user ever says "just go" / "skip the questions," you may batch confirmations, but
  you must still stop at GATE 1 and GATE 2.
- Keep `CLAUDE.md` authoritative for conventions.
- react-doctor scores are heuristic — surface them as signals, not hard blocks.
