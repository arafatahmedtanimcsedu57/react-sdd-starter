Risk tier: high

Feature: none (harness change — it changes how features are built, not what the app does)

## Why

The harness was built for one person, one Claude and one checkout. A team breaks it:

- Two developers each keep a "current" `features.json`, ledger and `PROGRESS.md`; every PR
  conflicts on them, and a badly resolved ledger conflict reads as "edited by hand".
- WIP=1 is checked per branch, so `master` can end up with several `active` features.
- A developer can approve their own `tasks.md` and merge their own PR.
- One Claude session per developer is slow for big features (Login/Registration, Dashboard,
  Profile each have many tasks), and running several sessions by hand loses track of who is
  doing what — and context lost between sessions is where the agent starts guessing.

## What changes

A developer works through **one orchestrator session** that splits their features into
tasks, starts **one worker session per task** (a background agent in its own git worktree),
shows a board of what every worker is doing under readable names, and collects every
question and approval the workers need from the owner.

1. **Ownership** — every feature in `features.json` has an `owner` (git email). An
   orchestrator only plans and builds features its developer owns.
2. **Task = one OpenSpec change = one worker = one PR.** Gate 1 is per task: the worker
   drafts its `tasks.md`, then waits until the owner approves it in the orchestrator.
3. **Merge-safe shared state** — the ledger merges by union, feature _state_ is replayed
   from the ledger instead of being stored twice, `PROGRESS.md` gets one section per owner,
   and live task status stays in a local, untracked board.
4. **Cross review** — CI requires a PR approval from someone other than the PR author;
   CODEOWNERS lists both developers. You review X's PRs, X reviews yours.
5. **A seventh human command**, `/orchestrate`, opens the board and drives the workers.

## Decisions taken with the human (2026-11-08)

- Workers are started automatically by the orchestrator, as background agents in worktrees
  (not terminals the developer opens by hand).
- Gate 1 is per task (each task's `tasks.md`), not once per feature.
- PRs are reviewed by the other developer.

## Non-goals

- Orchestrators of two developers talking to each other. They coordinate only through git:
  `features.json` ownership, OpenSpec changes and PRs.
- Running workers on a server or after the orchestrator window closes. Workers stop with
  the orchestrator; the board and worktrees survive and `/orchestrate` resumes them.
- Changing the app (`src/`).
- A UI for the board outside the terminal.

## Open questions

1. **Seventh command name** — suggested default: `/orchestrate` (alias-free). Needs a
   CLAUDE.md change ("the human uses exactly six") — yours to approve.
2. **Max workers per orchestrator** — suggested default: 4, configurable in
   `.claude/orchestra.json`. More workers = more of your attention and more tokens.
3. **Two tasks touching the same folder** — suggested default: the orchestrator never runs
   them at the same time; the second waits on the board as "queued (shares src/routes with
   Login form)".
4. **Hooks inside worker worktrees** — not yet verified that `Stop`/`SubagentStop` hooks and
   `$CLAUDE_PROJECT_DIR` point at the worker's worktree. Slice 1 is a spike that proves it
   before anything else is built; if it fails, the fallback is a worker that runs
   `npm run scope` + `npm run check` itself before reporting done.
5. **Cross-feature contracts** — Dashboard/Profile depend on Login's auth. Suggested
   default: a task can declare `depends on: <change-name>`; the orchestrator won't start it
   until that change is merged, unless it only needs the contract (schema + MSW mock),
   which is then always the dependency's first task.

## Impact

- `scripts/harness/` (features, scope, progress, a new board script), `.claude/` (a
  command, a worker agent, hooks), `.github/` (CI, CODEOWNERS), `CLAUDE.md`, `PIPELINE.md`,
  `.gitattributes`, `.gitignore`. No app code. No new npm dependency.
