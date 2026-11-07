Risk tier: high

Feature: none (harness change)

depends on: team-merge-safe-state (merged, PR #31)

## Why

Slice 3 of `team-orchestration` — the part a developer actually uses. Slices 1–2 made the
harness safe for parallel work (hooks check each worker's worktree; state merges cleanly;
features have owners). Nothing yet _runs_ that parallel work: today a developer drives one
Claude session per task by hand and loses track of which session is doing what.

## What changes

1. **`/orchestrate [feature]`** — a seventh human command. The developer's main session
   becomes their orchestrator: it plans a feature into tasks, starts one **worker** per
   task, keeps a **board** with readable names, and is the only place the owner answers.
2. **`task-worker` agent** — runs one task in its own worktree: drafts the task's OpenSpec
   change, waits for Gate 1, builds, checks, opens the PR. Ends every stop with a `STATUS:`
   line and a commit, so nothing lives only in its memory.
3. **`npm run board`** — prints the board and the "Needs you" queue, and is the only way
   the orchestrator changes it (`board -- add | set | next`), like `npm run features`.
4. **`guard-bash.sh`** — also blocks a bare `git push` whose push target resolves to the
   default branch (the open question from slice 1's review: a worker branch tracking
   `origin/master` with `push.default=upstream`).

## What slices 1–2 taught, and how this design follows

- Claude Code cuts worker worktrees **from `master`**, not the current branch → a worker
  never sees uncommitted orchestrator state; everything a worker needs is in its brief or
  on `master`.
- Hooks only check a worker that runs **inside its own worktree** (`cwd`) → workers are
  started with worktree isolation, never pointed at a folder from the main checkout.
- Two branches moving the same feature in the ledger is a **forked history**, which
  `features check` now rejects → only a feature's **first task** writes `add` / `start`,
  and only the orchestrator's **closing PR** writes `verify`. Other tasks never touch the
  ledger.
- A background worker stops when the orchestrator's window closes → workers commit before
  every stop, the board is a file, and `/orchestrate` resumes from it.

## Non-goals

- Two developers' orchestrators talking to each other (git is the channel).
- Running workers after the window is closed, or on a server.
- Cross-review CI, CODEOWNERS, `TEAM.md` (slice 4).
- Narrower-than-feature scope enforcement per task (task `folders` are used for scheduling
  only; the scope check still uses the feature's scope).

## Open questions

1. **Worker cap** — suggested default: 4 per orchestrator (`.claude/orchestra.json`,
   committed so the team shares it).
2. **Who writes `approved:`** — suggested default: the orchestrator writes it into the
   worker's worktree after the owner says "approve", and the worker is told never to.
   Keeps the "only a human approves" rule checkable in one place.
3. **CLAUDE.md is at 198/200 lines** — adding the seventh command needs room. Suggested
   default: move the vendored-OpenSpec name mapping (4 lines) into a new
   `.claude/rules/commands.md` and link it.
4. **PR size** — estimated ~380 reviewable lines, close to the limit, mostly Markdown
   (command + agent). CI still counts `*.test.mjs`; the one-line exclusion fix from slice 2
   would help but is a separate CI change — yours to approve or not.

## Impact

`.claude/commands/orchestrate.md`, `.claude/agents/task-worker.md` (new),
`scripts/harness/board.mjs` (new) + `lib.mjs` + tests, `.claude/hooks/guard-bash.sh`,
`.claude/orchestra.json` (new), `.gitignore`, `package.json` (one script), `CLAUDE.md`,
`.claude/rules/commands.md` (new), `PIPELINE.md`, `README.md`. No app code, no new
dependency.
