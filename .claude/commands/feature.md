---
description: Run one feature or change through the spec-driven loop in an existing repo. Lighter than /react-project — no bootstrap, fewer prompts, but still stops at both gates.
---

# /feature

Day-to-day driver for a single change in an already-set-up repo. Assumes `openspec`
(`/opsx:*` commands), tests, `CLAUDE.md`, and `.claude/settings.json` hooks already exist.
Follow the `feature-pipeline` skill for step details; this command just runs the loop with
minimal ceremony.

Argument: `$ARGUMENTS` is the feature/change description. If empty, ask what to build.

## Behaviour

- Move briskly. Don't ask permission for routine, reversible steps (writing spec files,
  running tests, running react-doctor). DO confirm before irreversible or noisy actions
  (installing packages, git push, opening a PR) — settings.json asks for these anyway.
- Stop and ask on the triggers in `CLAUDE.md` → Human in the loop. One question, with
  your recommended answer.
- **Always stop at the two gates**, even in fast mode.

## Steps

1. **Define** — capture intent in `features.md` / `architecture.md` if the change needs it.
   For small changes, a one-line note is fine. Use `codebase-explorer` if you need to find
   where things live. If the change touches an API, **establish the contract first** (see
   `CLAUDE.md` → API contracts): generate/hand-write from a spec, capture an informal contract
   as Zod schemas, or — if the API isn't built yet — write the contract and mock it with MSW.
2. **Spec + GATE 1** — run `/opsx:propose`. If the change will exceed 400 reviewable
   lines, split it into smaller changes (one per PR; see the skill). Send the short Gate 1
   brief from the skill (risk, size, decisions needed with defaults) and STOP. On explicit
   approval, record `approved: <name>, <date>` in `tasks.md`.
   For a **low**-risk change the human may say "skip Gate 1" — then note that in the PR.
3. **Implement** — if the conversation is long, ask the human to `/clear` and run
   `/opsx:apply <change>`; otherwise run it directly. Implement task-by-task with tests.
   Hooks self-correct on each edit and at turn end. Run `react-reviewer` after a chunk.
4. **Verify** — must pass before done: `npm run check` (+ `npm run test:e2e` for flows).
5. **Ship + GATE 2** — open a PR (never merge) using `.github/pull_request_template.md`,
   filling in "Review carefully", "Decisions I made without asking" and "Safe to skim".
   Report CI status + preview URL (if deploys are wired), then STOP for review. After
   merge, offer `/opsx:archive` and propose `CLAUDE.md` rules for repeated corrections.

## Reminder

Two gates: `tasks.md` review before implementing (skippable only for low-risk changes, and
only when the human says so), PR review before merge (never skippable). Everything between
them can move fast.
