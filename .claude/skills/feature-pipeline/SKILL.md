---
name: feature-pipeline
description: >-
  Spec-driven, self-correcting workflow for building or changing a feature in this
  React (Vite + TypeScript) app. Use this skill whenever the user asks to build, add,
  implement, change, refactor, or fix a feature, component, page, screen, form, or bug —
  even if they never say the word "pipeline" or "spec". It enforces the full loop:
  plan -> features.md/architecture.md -> OpenSpec propose -> HUMAN review of tasks.md ->
  implement per spec -> self-correct with hooks + tests + react-doctor -> open a PR.
  Always follow these steps for any non-trivial feature or change; never skip the
  tasks.md review gate or the definition-of-done checks.
---

# Feature pipeline

A disciplined, spec-driven loop for shipping React changes. The human owns intent and
final review; you (the agent) own execution; the machine enforces quality. There are two
gates you must never skip.

## When to use

Use this for any change that is more than a one-line edit: new features, new components
or pages, non-trivial refactors, and bug fixes that touch behaviour.

**When NOT to use:** trivial one-liners (a typo, a copy tweak, a single style value). Just
make those directly — don't spin up the whole loop.

## The two human gates (never skip)

1. **Review `tasks.md`** after OpenSpec propose, BEFORE implementing. Stop and let the
   human approve. This is the cheapest place to fix wrong intent.
2. **Review the PR + preview deploy**, BEFORE merge. You open the PR; you do not merge it.

If the human is not available to clear a gate, stop and wait. Do not proceed past a gate
on your own.

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

### 2. Design (optional, for UI work)

- For new UI, use the frontend UI design skill to generate an HTML/CSS mockup from
  `features.md` + the tokens in `architecture.md`. This is the visual target to match,
  since you cannot see the rendered result yourself.

### 3. Spec + GATE 1

- Run OpenSpec's **propose** command (the slash command registered by `openspec init`).
  It produces `proposal.md`, delta specs, `design.md`, and `tasks.md` under
  `openspec/changes/`.
- **STOP. Present `tasks.md` to the human and wait for approval.** Confirm: scope is right,
  task order is sane, the design references the mockup and tokens.

### 4. Implement loop (self-correcting)

- Before implementing, clear context (`/clear`) so you work from the spec file, not a
  bloated transcript.
- Run OpenSpec's **apply** command. Work down the `tasks.md` checklist one item at a time.
- On every edit, the hooks run automatically (prettier + typecheck), and react-doctor's
  agent-hook feeds findings back. React to those findings immediately — fix, don't defer.
- Write tests as you go (see "Testing standard" below). Every new piece of logic gets a test.
- Place every new file according to the **folder structure** in `CLAUDE.md`; never invent a
  new top-level folder or a parallel one that does the same job.
- After a coherent chunk of work, delegate a review to the `react-reviewer` subagent and
  address what it reports before continuing.

### 5. Verify — definition of done

You may not consider a task complete until this passes:

```
npm run typecheck && npm run lint && npm run test && npm run doctor
```

If any step fails, fix it and re-run. This is the self-correct loop — do not stop on red.

### 6. Ship + GATE 2

- Open a pull request. CI will re-run the full gate; Vercel will post a preview URL.
- **STOP. Do not merge.** Present the PR and preview to the human for review.
- After the human merges, run OpenSpec's **archive** command to fold the change into the
  living specs under `openspec/specs/`.

## Testing standard

Three layers, all via Vitest / React Testing Library / Playwright:

- **Unit** — pure logic (e.g. `src/lib/*.ts`). Fast, deterministic, highest value.
- **Component** — render + user interaction via `@testing-library/user-event`. Query by
  label and role (not by class) so the test also verifies accessibility.
- **E2E** — Playwright for the key user flow. This is what verifies the rendered UI, since
  you cannot see it. Assert on visible text and roles.
- **Mocking** — MSW is the default mock layer for component + e2e tests, with handlers derived
  from the API contract; keep fixtures valid against the Zod schemas.

## Subagents

- `react-reviewer` — delegate a review after implementing a chunk. It reports issues
  (correctness, a11y, re-renders, convention violations) and runs react-doctor; it does not
  edit. Fix what it finds yourself.
- `codebase-explorer` — delegate codebase research (finding where things live, tracing a
  pattern) so the exploration doesn't bloat your main context. It returns a file map.

## Guardrails

- Never skip either human gate.
- Keep conventions in `CLAUDE.md` authoritative (named exports, one component per file,
  colocated tests, the styling approach + UI library recorded in `architecture.md`, data
  fetching in `use*` hooks). State & data rules: **RTK Query** for server state/data fetching
  (no raw fetch/axios in components), **Zustand** for client/UI state (no Redux slices for UI),
  **React Hook Form + Zod** for forms — see `CLAUDE.md` for the patterns.
- react-doctor scores are heuristic — a drop means "look here," not "auto-block." Real
  tests verify behaviour; react-doctor verifies smell. Keep both.
- Prefer the cheapest model that can do the task; reduce context before implementation.
