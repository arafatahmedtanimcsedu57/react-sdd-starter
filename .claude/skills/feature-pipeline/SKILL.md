---
name: feature-pipeline
user-invocable: false
description: >-
  Spec-driven, self-correcting workflow for building or changing a feature in this
  React (Vite + TypeScript) app. Use this skill whenever the user asks to build, add,
  implement, change, refactor, or fix a feature, component, page, screen, form, or bug —
  even if they never say the word "pipeline" or "spec". It enforces the full loop:
  plan -> features.md/architecture.md -> Claude Design -> OpenSpec propose -> HUMAN review
  of design + tasks.md -> implement per spec and design -> self-correct with hooks + tests +
  react-doctor + screenshots -> open a PR.
  Always follow these steps for any non-trivial feature or change; never skip the
  tasks.md review gate or the definition-of-done checks. A bug in already-shipped,
  specified behaviour takes the lighter /fix lane instead (see "When to use").
---

# Feature pipeline

A disciplined, spec-driven loop for shipping React changes. The human owns intent and
final review; you (the agent) own execution; the machine enforces quality. There are two
gates you must never skip.

## When to use

Use this for any change that is more than a one-line edit: new features, new components
or pages, non-trivial refactors, and bug fixes that change specified behaviour.

**Bugs go to `/fix` first.** A bug in behaviour that is already specified and shipped —
no new UI, no contract change, no new dependency, ~100 lines or fewer — takes the light
lane in `.claude/commands/fix.md`: failing test → minimal fix → PR (Gate 2 only). Use this
pipeline only when the bug turns out to need a spec or design change.

**When NOT to use:** trivial one-liners (a typo, a copy tweak, a single style value). Just
make those directly — don't spin up the whole loop.

The human drives it with six commands: `/start` (once), `/feature` (design + spec),
`/build` (Gate 1 → code → PR), `/sync-ui` (design edits → code), `/finish` (after merge),
and `/fix` (bug in shipped behaviour → test-first fix → PR).
Claude Design is the UI source of truth — see `claude-design.md` in this folder.

## The two human gates (never skip)

1. **Review the design + `tasks.md`** (`/build` asks) BEFORE implementing. Stop and let the
   human approve. This is the cheapest place to fix wrong intent or a wrong look.
2. **Review the PR + preview deploy**, BEFORE merge. You open the PR; you do not merge it.

If the human is not available to clear a gate, stop and wait. Do not proceed past a gate
on your own.

Humans are busy. Make each gate cheap: ask for **decisions**, not a full read. A good gate
message fits on one screen and can be answered with "yes", "yes except 2", or a short
correction. How much attention a change needs depends on its **risk tier** (see
`CLAUDE.md` → Human in the loop).

## Steps

### 1. Define (human-led)

- If the request is vague, discuss it first (plan mode). Do not write code yet.
- Ensure `features.md` captures the user-facing behaviour, states, and edge cases.
- Ensure `architecture.md` records the **styling approach and UI component library** for the
  project (e.g. Tailwind + shadcn/ui, Bootstrap + React-Bootstrap, MUI, CSS Modules, etc.) and
  the design tokens (colours, spacing, fonts). Follow whatever is recorded there — do not
  default to Tailwind. If it isn't recorded yet, ask the user which to use before writing UI.
- These tokens must flow into the chosen styling layer (Tailwind config, MUI/Chakra theme,
  Sass variables, or CSS custom properties) — never hand-translate them later.
- Treat `features.md` / `architecture.md` as the inputs to OpenSpec. Do not maintain a
  second, parallel spec by hand.
- **Establish the API contract before any data-layer or UI work** (see `CLAUDE.md` → API
  contracts). Ask which case applies: (1) an OpenAPI/Swagger spec exists — generate the RTK
  Query layer from it, or hand-write if the spec is messy; (2) an informal contract — capture
  it as Zod schemas; (3) frontend-first, no API yet — write the contract first (Zod or OpenAPI
  stub) and stand up MSW mocks so the UI never blocks on the backend. Record the source in
  `architecture.md`.

### 2. Design (every change with UI)

- The design lives in Claude Design: one project canvas, one page per feature, themed by
  the project's Design System. Follow `claude-design.md` in this folder.
- The feature has a page → use it. No page → design it in the existing theme and look.
- The human may edit the design directly on claude.ai at any time. Always re-read the live
  canvas before building; never build from memory of an earlier version.

### 3. Spec + GATE 1

- Run OpenSpec **propose** (the `openspec-propose` skill). It produces
  `proposal.md`, delta specs, `design.md`, and `tasks.md` under `openspec/changes/`, and
  follows the rules in `openspec/config.yaml` (risk tier, open questions, size estimate,
  `approved: <pending>` line).
- **Size the change before Gate 1.** One OpenSpec change = one PR, and CI fails any PR over
  **400 reviewable lines** (tests, mocks, specs, lockfiles and generated code don't count —
  see `.github/workflows/pr-size.yml`). Estimate the size from `tasks.md`. If it will
  clearly exceed the limit, split it into several smaller OpenSpec changes, each
  independently shippable and ordered by dependency — typically:
  1. contract: Zod schema + RTK Query endpoints + MSW handlers
  2. UI: components + component tests
  3. wiring: route/page + e2e
     Note each change's dependencies in its `proposal.md` ("depends on: <change-name>").
- `/feature` stops here so the human can edit the design. **Gate 1 happens in `/build`**,
  after re-reading the design (the brief below plus a `Design:` link and a line on the
  human's design edits).
- **STOP at Gate 1.** Don't paste the whole `tasks.md`. Send a short brief:

  ```
  Gate 1 — <change-name>   Risk: <tier>   ~<n> reviewable lines   <split: 1 of 3 | none>
  Builds: <one sentence>
  Decisions I need (my default in brackets):
    1. <open question> [<default>]
    2. ...
  New dependencies: <none | pkg — why>
  Full plan: openspec/changes/<change-name>/tasks.md
  Reply "approve", or tell me what to change.
  ```

- When they approve, write their answers into `proposal.md` → "Open questions" and replace
  the last line of `tasks.md` with `approved: <their name>, <date>`. Only on their explicit
  approval — silence, "looks interesting" or a question is not approval.
- **Async option** (teams, or when the human isn't in this session): commit the change
  folder on a branch and open a **spec PR** (only `openspec/` files). CODEOWNERS routes it;
  the reviewer adds the `approved:` line in their review. Once merged, the change is eligible
  for `/build <change-name>` or autopilot (which builds from the `design/` copy).

### 4. Implement loop (self-correcting)

- Fresh context helps: you can't clear it yourself, so if the conversation is long, ask the
  human to run `/clear` and then `/build <change-name>`. If it's short, just continue.
- Before coding, copy the approved design page into `design/` (see `claude-design.md`) and
  sync any token changes into the styling layer. Match the artboards; use tokens, not hex.
- Run OpenSpec **apply** (the `openspec-apply-change` skill). It refuses to start while
  `tasks.md` still says `approved: <pending>`. Work down the checklist one item at a time.
- Hooks self-correct as you go: after every edit, prettier + eslint + typecheck run on the
  file; before you end a turn, the tests related to changed files and react-doctor run.
  Their errors come back to you — fix immediately, don't defer.
- Hit a decision the spec doesn't settle? Stop and ask (one question, your default
  attached). If it's minor and reversible, pick the default and log it in `notes.md`.
- Keep `openspec/changes/<change-name>/notes.md` as you go — one line per entry, written
  when it happens, not at the end: decisions made without asking, dead ends ("tried X, fails
  because Y"), and anything the next session needs that the `tasks.md` ticks don't carry.
  A resumed build (after `/clear` or a compacted conversation) reads it before the first
  unticked task. The PR's "Decisions I made without asking" is built from it.
- Write tests as you go (see "Testing standard" below). Every new piece of logic gets a test.
- Place every new file according to the **folder structure** in `CLAUDE.md`; never invent a
  new top-level folder or a parallel one that does the same job.
- After a coherent chunk of work, delegate a review to the `react-reviewer` subagent and
  address what it reports before continuing.

### 5. Verify — definition of done

You may not consider a task complete until this passes:

```
npm run check        # typecheck + lint + format:check + test + doctor
npm run test:e2e     # if the change touches a user flow
```

Then the **visual self-check**: Playwright screenshots of each state at each design width,
compared with the artboards (`claude-design.md`). The e2e run includes axe accessibility
checks.

If any step fails, fix it and re-run. This is the self-correct loop — do not stop on red.
If the same failure survives 3 honest attempts, stop and tell the human what you tried and
what you think is wrong. Don't disable a test, a lint rule or a hook to get green.

### 6. Ship + GATE 2

- Check the size first: `git diff --numstat origin/HEAD...HEAD` (origin/HEAD is the default branch). If it's over the limit, stop and
  split the remaining work into a new OpenSpec change rather than growing this PR.
- Open a pull request that fills in **every section** of
  `.github/pull_request_template.md`. The "Review carefully" and "Safe to skim" sections
  are the point: tell the reviewer exactly which lines carry risk and why, so they don't
  have to read everything with equal attention.
- **How to open it** (every command that opens a PR follows this): write the filled-in
  description to `.git/PR_BODY.md` (inside `.git`, so it's never committed). If
  `gh auth status` succeeds, run `gh pr create --title "<title>" --body-file .git/PR_BODY.md`.
  If `gh` is missing or not signed in, don't just push and leave it: GitHub's web form would
  open with the empty template. Instead give the human the compare link
  (`https://github.com/<owner>/<repo>/compare/<branch>?expand=1`), the title, and the
  path to `.git/PR_BODY.md`, and ask them to paste it into the description. Then suggest
  installing `gh` (`gh auth login`) so next time it's automatic.
- CI will re-run the full gate plus the PR size check; Vercel will post a preview URL.
- **STOP at Gate 2. Do not merge** (it's blocked anyway). Send a short brief: PR link, risk
  tier, the 1–3 places to read carefully, and the "Decisions I made without asking" list.
- Review comments: address each one, reply on the thread with what you changed, and push.
  If you disagree with a comment, say why once and let the human decide.
- After the human merges, tell them to run `/finish <change-name>`: it folds the change into
  the living specs under `openspec/specs/` and marks it shipped in `features.md`.

### 7. Learn (after merge)

- Look back at what the human corrected at both gates. If a correction is a pattern (not a
  one-off), propose a one-line `CLAUDE.md` rule. Add it only if they agree.

## Testing standard

Three layers, all via Vitest / React Testing Library / Playwright:

- **Unit** — pure logic (e.g. `src/lib/*.ts`). Fast, deterministic, highest value.
- **Component** — render + user interaction via `@testing-library/user-event`. Query by
  label and role (not by class) so the test also verifies accessibility.
- **E2E** — Playwright for the key user flow. Assert on visible text and roles, and run axe
  (`@axe-core/playwright`) on each screen — no violations.
- **Visual** — screenshots per state and width, compared with the Claude Design artboards.
- **Mocking** — MSW is the default mock layer for component + e2e tests, with handlers derived
  from the API contract; keep fixtures valid against the Zod schemas.

## Subagents

- `react-reviewer` — delegate a review after implementing a chunk. It reports issues
  (correctness, a11y, re-renders, convention violations) and runs react-doctor; it does not
  edit. Fix what it finds yourself.
- `codebase-explorer` — delegate codebase research (finding where things live, tracing a
  pattern) so the exploration doesn't bloat your main context. It returns a file map.

## Guardrails

- Never skip either human gate, and never write the `approved:` line on your own.
- Keep PRs reviewable: one OpenSpec change per PR, at most 400 reviewable lines. Split the
  work instead of asking for the `large-pr-approved` label; that label is for the human to
  add for rare cases like a mechanical rename.
- Keep conventions in `CLAUDE.md` authoritative (named exports, one component per file,
  colocated tests, the styling approach + UI library recorded in `architecture.md`, data
  fetching in `use*` hooks). State & data rules: **RTK Query** for server state/data fetching
  (no raw fetch/axios in components), **Zustand** for client/UI state (no Redux slices for UI),
  **React Hook Form + Zod** for forms — see `CLAUDE.md` for the patterns.
- react-doctor scores are heuristic — a drop means "look here," not "auto-block." Real
  tests verify behaviour; react-doctor verifies smell. Keep both.
- Prefer the cheapest model that can do the task; reduce context before implementation.
