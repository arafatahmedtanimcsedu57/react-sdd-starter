---
description: Set up a new project from this template (run once) — names it, picks styling + UI library, writes the first requirements, and creates its Claude Design theme and screens. Asks before every step.
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
- Add `src/routes/HomePage.tsx` (a `<main>` with an `<h1>` of the project name) and point the
  index route in `src/routes/routes.tsx` at it (keep it lazy). Update the first test in
  `src/routes/routes.test.tsx` to expect that heading. Leave `RootLayout`, `RouteError`,
  `RouteLoading` and `src/App.tsx` as they are.
- `src/mocks/handlers.ts` → `export const handlers = []` plus an exported no-op
  `resetMockData()` (the test setup calls it); keep the comment about parsing fixtures
  through the Zod schema.
- `src/stores/useUiStore.ts` → reset to an empty example store (keep the file; the test
  setup resets it between tests).
- `e2e/smoke.spec.ts` → assert the placeholder heading renders; keep the axe test.
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
- Ask hosting / preview deploys (Vercel, Netlify, other, not yet) and record it. Don't wire
  a deploy workflow here — CD is project-specific; offer it as a later `/feature`.

## Step 5 — Design (Claude Design)

Follow `.claude/skills/feature-pipeline/claude-design.md`. Needs this session signed in to
claude.ai; if the Artifact tool isn't available, say so, skip this step, and note in
`architecture.md` → Design that it's pending.

1. **Theme.** Ask for the look: primary colour, fonts (display + body), corner radius, and
   the breakpoints to design for (default mobile 390 + desktop 1280). Offer one concrete
   proposal as the default; the human can say "you pick".
2. **Design System.** Create it with those tokens. Write its tokens into the styling layer
   (Tailwind 4: the `@theme` block in `src/styles/index.css`) and the table in
   `architecture.md` → Design tokens.
3. **Canvas.** Create the project canvas (title = project name), install the design system,
   and add **one page per feature** in `features.md`, one artboard per state per width.
   Put each open decision on its page as an orange sticky note.
4. Record both links and the breakpoints in `architecture.md` → Design.
5. Tell the human: "Open the design, change anything you like directly on the canvas. When
   a feature looks right, run `/build <feature>`." (Its spec is written by `/feature
<feature>` first — say which to run for each feature.)

## Step 6 — Commit + PR

Commit the setup on `chore/project-setup` and, after confirming, push and open a PR that
fills in **every section** of `.github/pull_request_template.md` — never leave the template's
placeholders. There's no OpenSpec change or Gate 1 here, so say so, and list each new
dependency under "Review carefully" for the human to approve.

This PR is always over the size limit, so add a "Why this is N lines" section: run
`git diff --numstat origin/HEAD...HEAD` and group the lines into deleted template example /
docs / generated (shadcn CSS, config JSON) / config + code, with the count for each and
which need careful review. Then suggest the human add the `large-pr-approved` label.

Open it as the feature-pipeline skill says (step 6 → "How to open it"), so the description
reaches GitHub even when `gh` isn't installed.

## Step 7 — GitHub checklist (human-only — list it, don't do it)

Print this checklist for the human; the agent can't and shouldn't do these:

1. In `claude`: `/install-github-app` (adds the `ANTHROPIC_API_KEY` secret for `@claude`).
2. `.github/CODEOWNERS`: replace the template owner with the real reviewers.
3. Branch protection on the default branch: require `CI` + `PR size`, 1 review, Code Owner
   review.
4. Create the `large-pr-approved` label (repo → Issues → Labels → New label). Labels aren't
   copied from the template, and the setup PR needs it to pass the size check.
5. Optional: repo variable `AUTOPILOT_ENABLED=true` for nightly autopilot.

## Hand off

Summarise what was set up (name, styling, UI library, API case, first features, design
links), then say: "Merge the setup PR. Edit the design if you like, then for each feature
run `/feature <feature>` (it reuses the page already designed) and `/build <change>`." Stop.
