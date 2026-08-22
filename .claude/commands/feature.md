---
description: Run one feature or change through the spec-driven loop in an existing repo. Lighter than /react-project — no bootstrap, fewer prompts, but still stops at both gates.
---

# /feature

Day-to-day driver for a single change in an already-set-up repo. Assumes `openspec`,
tests, react-doctor agent-hooks, `CLAUDE.md`, and `.claude/settings.json` already exist.
Follow the `feature-pipeline` skill for step details; this command just runs the loop with
minimal ceremony.

Argument: `$ARGUMENTS` is the feature/change description. If empty, ask what to build.

## Behaviour

- Move briskly. Don't ask permission for routine, reversible steps (writing spec files,
  running tests, running react-doctor). DO confirm before irreversible or noisy actions
  (installing packages, git push, opening a PR).
- **Always stop at the two gates**, even in fast mode.

## Steps

1. **Define** — capture intent in `features.md` / `architecture.md` if the change needs it.
   For small changes, a one-line note is fine. Use `codebase-explorer` if you need to find
   where things live. If the change touches an API, **establish the contract first** (see
   `CLAUDE.md` → API contracts): generate/hand-write from a spec, capture an informal contract
   as Zod schemas, or — if the API isn't built yet — write the contract and mock it with MSW.
2. **Spec + GATE 1** — run OpenSpec **propose**, then present `tasks.md` and STOP for
   approval.
3. **Implement** — `/clear`, run OpenSpec **apply**, implement task-by-task with tests.
   Hooks + react-doctor self-correct on each edit. Run `react-reviewer` after a chunk.
4. **Verify** — must pass before done:
   `npm run typecheck && npm run lint && npm run test && npm run doctor`
5. **Ship + GATE 2** — open a PR (never merge). Report CI status + Vercel preview URL, then
   STOP for review. After merge, offer to run OpenSpec **archive**.

## Reminder

Two gates are non-negotiable: `tasks.md` review before implementing, PR review before merge.
Everything between them can move fast.
