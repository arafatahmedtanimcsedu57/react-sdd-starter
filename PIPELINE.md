# Agentic Development Pipeline

An end-to-end, spec-driven, self-correcting pipeline for building **any** React
(Vite + TypeScript) app with Claude Code, with preview deploys per PR (e.g. Vercel). It combines a human-owned
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
IMPLEMENT LOOP    (/clear) → /feature <change> → implement
   ↻ self-correct   after each edit: prettier + eslint + typecheck (errors fed back)
                     at turn end: related tests + react-doctor (errors fed back)
                     npm run check at the done-gate
VERIFY            CI: typecheck · lint · format · unit · e2e · react-doctor (changed)
SHIP              Vercel preview deploy per PR
   ★ GATE 2       you review the PR + preview URL
                  merge → prod deploy → /finish → living specs
```

Ownership: **you drive** DEFINE and both gates; **the agent runs** DESIGN, SPEC, IMPLEMENT;
**the machine enforces** VERIFY. See "Human involvement" below for what that costs you.

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
│   ├── skills/                   # feature-pipeline + openspec-* (hidden; Claude uses them)
│   ├── agents/                   # react-reviewer, codebase-explorer
│   └── commands/                 # /start, /feature, /finish — the only user commands
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

This starter already has OpenSpec initialised, the MSW worker committed, and every tool
pinned in `package.json`. What's left is the human-only setup on GitHub:

```bash
npm ci && npx playwright install chromium
# From inside `claude` in the repo:  /install-github-app   (adds ANTHROPIC_API_KEY)
```

1. **Branch protection** on the default branch: require `CI` + `PR size` checks, 1 review,
   and "Require review from Code Owners". Edit `.github/CODEOWNERS` with real people.
2. **Preview deploys** (Vercel, Netlify, …) so Gate 2 can include a click-through.
3. **Autopilot** stays off until you set the repo variable `AUTOPILOT_ENABLED=true`.

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
2. **★ GATE 1 — answer the brief before implementing.** The agent sends risk tier, size and
   the open decisions with its defaults; your explicit approval becomes the
   `approved: <name>, <date>` line in `tasks.md`. Cheapest place to fix intent — and
   the place to control PR size. One change = one PR, max 400 reviewable lines; anything
   bigger gets split into several changes here (e.g. contract → UI → wiring).

## Phase 4 — Implement loop (agent runs, self-correcting)

1. `/clear` (implement against the spec file, not a bloated transcript).
2. Run OpenSpec **apply**. Work down `tasks.md`, placing files per the folder structure.
3. Self-correction on each edit: hooks run prettier + typecheck; react-doctor's agent-hook
   feeds findings back. Write tests as you go.

**Definition of done** (in `CLAUDE.md`, run before any task is finished):

```
npm run check
```

## Phase 5 — Verify + Ship + Gate 2

1. Agent opens a PR (manually, via `@claude`, or via autopilot).
2. **CI gate** runs: typecheck, lint, unit + component tests, e2e, `react-doctor --scope changed`, `format:check`,
   plus the **PR size check** (`pr-size.yml`, 400 reviewable lines; the `large-pr-approved`
   label bypasses it). The PR body follows `.github/pull_request_template.md` so the reviewer
   knows what to read closely and what to skim.
3. Your preview host (e.g. Vercel) posts a **preview URL** — eyeball it (closes the visual gap).
4. **★ GATE 2 — review the PR + preview**, then merge.
5. Run OpenSpec **archive** to fold the change into living specs.

---

## The two automation layers

**Enforcement (CI/CD)** — `ci.yml` is the machine that catches mistakes; it must exist before
anything autonomous writes code. Nothing merges red.

**Execution (autonomous agent)** — `anthropics/claude-code-action@v1` turns work into PRs:

- **On-demand:** mention `@claude` on an issue → it branches, implements, tests, opens a PR.
- **Scheduled:** off by default. When enabled, a weekday-night job picks the next
  **approved** `openspec/changes/` folder and opens a PR. It won't guess: unanswered open
  questions, a needed dependency, or an oversized change become a GitHub issue for a human.
- **Own hardware:** point the job at a self-hosted runner instead of `ubuntu-latest` to run on
  your own machine.

Every autonomous PR still lands at Gate 2.

---

## Configuration reference

The files are the documentation — this playbook doesn't copy them (copies drift).

| What                                   | Where                                                  |
| -------------------------------------- | ------------------------------------------------------ |
| Conventions + human rules              | `CLAUDE.md`                                            |
| Product intent                         | `features.md`                                          |
| Tech decisions + tokens                | `architecture.md`                                      |
| Spec rules (risk, size, approval line) | `openspec/config.yaml`                                 |
| Edit-time self-correction              | `.claude/hooks/post-edit.sh` (prettier + eslint + tsc) |
| Turn-end self-correction               | `.claude/hooks/stop-check.sh` (related tests + doctor) |
| What the agent may not do              | `.claude/settings.json` → `permissions`                |
| Workflow for the agent                 | `.claude/skills/feature-pipeline/SKILL.md`             |
| User commands                          | `.claude/commands/` (`/start`, `/feature`, `/finish`)  |
| Enforcement gate                       | `.github/workflows/ci.yml`, `pr-size.yml`              |
| Agent executors                        | `.github/workflows/claude.yml`, `autopilot.yml`        |
| Who reviews what                       | `.github/CODEOWNERS`                                   |
| What a PR must say                     | `.github/pull_request_template.md`                     |
| Worked example (3 layers)              | `src/features/items/`, `src/routes/ItemsPage*`, `e2e/` |

---

## Human involvement — what it actually looks like

The gates only work if they fit into a real person's day. The rules that make that true:

- **Ask for decisions, not reading.** Gate 1 is a one-screen brief: risk tier, size, and
  the open questions with the agent's default for each. Most approvals are "yes" or
  "yes, except 2". The full `tasks.md` is there if you want it.
- **Attention scales with risk.** Every proposal carries a tier (low / medium / high, see
  `CLAUDE.md`). Low-risk work can skip Gate 1 if you say so; high-risk work gets a second
  reviewer. Reviewing a copy change like a schema change burns people out.
- **Approval is a fact, not a vibe.** `tasks.md` ends with `approved: <pending>`. Only a
  human's explicit "approve" (in chat, or in a spec-PR review) turns it into
  `approved: <name>, <date>`. `/feature` and autopilot refuse to implement unapproved changes.
- **Async by default for teams.** If the approver isn't in the session, open a spec-only
  PR; CODEOWNERS routes it. Merged spec = approved spec.
- **Surfaced judgement calls.** Agent PRs list "Decisions I made without asking", so the
  reviewer confirms choices instead of hunting for them in the diff.
- **Hard stops are enforced by tools, not prose.** Merging, force-pushing and pushing to
  the default branch are denied in `.claude/settings.json`; installs, pushes and edits to
  CI / `CLAUDE.md` ask first; branch protection is the backstop.
- **The agent escalates instead of looping.** Three failed attempts at the same check →
  it stops and explains. It never disables a test or rule to get green.
- **Corrections compound.** When a reviewer corrects the same thing twice, the agent
  proposes a one-line `CLAUDE.md` rule, and the human decides whether to add it.

A realistic week for one reviewer: ~5 min per Gate 1 brief, ~10–20 min per Gate 2 PR
(preview click-through + the "Review carefully" lines), and a glance at autopilot's
"Question:" / "Split needed:" issues each morning.

---

## Guardrails

- **Branch protection is non-negotiable.** Require the CI check + 1 review on `main`.
- **Context hygiene.** `/clear` before implementation.
- **react-doctor scores are heuristic** — treat a drop as "look here," not "auto-block."
  Real tests verify behaviour; react-doctor verifies smell. (Dead-code detection was dropped
  in v0.2 — run `npx knip` separately if you want it.)
- **Cost.** The agent consumes API tokens + Actions minutes; workflows cap `--max-turns` and
  `timeout-minutes`. `--scope changed` keeps react-doctor from failing on legacy issues.
- **Fork security.** On fork PRs the default `pull_request` event can't read
  `ANTHROPIC_API_KEY` (safe). Never use `pull_request_target` with untrusted fork code.

---

## Daily loop (the TL;DR)

1. Plan-mode chat → update `features.md` / `architecture.md`.
2. `/feature <idea>` → answer the Gate 1 brief → agent records `approved:` (Gate 1).
3. `/clear` → `/feature <change>` → agent implements; hooks + react-doctor + tests self-correct.
4. PR opens → CI runs → preview deploy appears.
5. **Review PR + preview** (Gate 2) → merge → `/finish <change>`.

Two gates, everything else automated.
