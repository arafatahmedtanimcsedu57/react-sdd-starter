---
description: Set up a new project from this template (run once) — asks questions and requests permission before every step, then hands off to /feature.
---

# /start

First-run setup for a repo created from this template ("Use this template" on GitHub).
Everything is already installed and wired — this command **personalises** it. It never
scaffolds a new app (no `npm create vite`) and never reinstalls the standing libraries.

Optional argument: `$ARGUMENTS` may contain the project name or a one-line description.

## How you must behave

1. **One decision at a time.** Ask a single concrete question with 2–4 options and your
   recommended default, then wait.
2. **Permission before action.** Before editing files, installing packages, or any git
   operation, say exactly what you will do, then wait for a "yes".
3. **Report after each step** (what changed, pass/fail), then propose the next step.
4. Work on a branch `chore/project-setup`, never on the default branch.
5. If the user says "just go", batch the confirmations — but still ask every decision.

## Step 0 — Check this is a fresh template copy

- `package.json` `name` is still `react-sdd-starter` and `src/features/items/` exists →
  fresh copy, continue.
- Otherwise setup already ran. Say so, and suggest `/feature` instead. Stop.
- Run `npm ci` if `node_modules` is missing, and `cp .env.example .env` if `.env` is missing.

## Step 1 — Name the project

Ask for the project name (kebab-case) and a one-line description. Then update:

- `package.json` `name` (and `package-lock.json` top-level `name` fields)
- `CLAUDE.md` title line (`# Project conventions — <name>`)
- `README.md`: replace the starter intro with the project name + description; keep the
  Quick start, Scripts, and "How to use the pipeline" sections

## Step 2 — Styling + UI library

The template ships **Tailwind CSS 4** and **no UI library** (see `architecture.md`).

1. Ask the styling approach, default **keep Tailwind**: a) Tailwind (keep) b) CSS Modules
   c) Plain CSS / Sass d) CSS-in-JS (styled-components / Emotion).
2. Ask the UI library, default **shadcn/ui** (fits Tailwind): a) shadcn/ui b) MUI
   c) Chakra UI d) Ant Design e) Radix primitives f) none — hand-built.
   Flag conflicts (e.g. shadcn/ui without Tailwind) and offer the compatible option; don't
   switch it silently.
3. Apply only what changes, stating exact packages first (installs ask anyway):
   - Dropping Tailwind: `npm uninstall tailwindcss @tailwindcss/vite`, remove `tailwindcss()`
     from `vite.config.ts` and `@import 'tailwindcss'` / `@theme` from `src/styles/index.css`.
   - shadcn/ui: `npx shadcn@latest init` (primitives land in `src/components/ui/`).
   - MUI: `npm i @mui/material @emotion/react @emotion/styled`
   - Chakra: `npm i @chakra-ui/react @emotion/react`
   - Ant Design: `npm i antd` · Radix: install the primitives you need as you need them.
4. Record both choices in `architecture.md` → Decisions, with the user's name and today's
   date in "Decided by / date" (replace "starter default" for the rows they confirmed).
   Remove the UI-library item from "Open decisions".

## Step 3 — Remove the `items` example

Ask first (default **yes, remove it**). If yes:

- Delete `src/features/items/`, `src/routes/ItemsPage.tsx`, `src/routes/ItemsPage.test.tsx`.
- `src/App.tsx` → a minimal placeholder shell (an `<h1>` with the project name).
- `src/mocks/handlers.ts` → `export const handlers = []` plus an exported no-op
  `resetMockData()` (the test setup calls it); keep the comment about parsing fixtures
  through the Zod schema.
- `src/stores/useUiStore.ts` → reset to an empty example store (keep the file; the test
  setup resets it between tests).
- `e2e/smoke.spec.ts` → assert the placeholder heading renders.
- `features.md` → remove the Items entry; `architecture.md` → remove the `items` row from
  API contract.
- Leave `src/lib/math.ts` (the unit-test example) unless the user asks.
- Run `npm run check` and `npm run test:e2e`; fix until green.

## Step 4 — First intent: `features.md` + `architecture.md`

- Ask what the product is and who it's for; draft the first 1–3 feature entries in
  `features.md` using the template format (behaviour, states, edge cases, open questions).
  Show the draft, get approval.
- Ask the API situation and record it under API contract (see `CLAUDE.md` → API contracts):
  a) OpenAPI spec exists (path/URL — offer `npm run gen:api`) b) informal contract
  (Postman / sample JSON) c) frontend-first, no API yet (Zod + MSW).
- Ask for design tokens (primary colour, body font, radius) or leave them `_unset_`.
- Ask hosting / preview deploys (Vercel, Netlify, other, not yet) and record it. Don't wire
  a deploy workflow here — CD is project-specific; offer it as a later `/feature`.

## Step 5 — Commit + PR

Commit the setup on `chore/project-setup` and, after confirming, push and open a PR. This
PR is mostly deletions and config — suggest the human add the `large-pr-approved` label if
the size check fails.

## Step 6 — GitHub checklist (human-only — list it, don't do it)

Print this checklist for the human; the agent can't and shouldn't do these:

1. In `claude`: `/install-github-app` (adds the `ANTHROPIC_API_KEY` secret for `@claude`).
2. `.github/CODEOWNERS`: replace the template owner with the real reviewers.
3. Branch protection on the default branch: require `CI` + `PR size`, 1 review, Code Owner
   review.
4. Optional: repo variable `AUTOPILOT_ENABLED=true` for nightly autopilot.

## Hand off

Summarise what was set up (name, styling, UI library, API case, first features), then say:
"Merge the setup PR, then run `/feature <first feature>`." Stop.
