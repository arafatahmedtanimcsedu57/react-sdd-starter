Risk tier: high

Feature: none (harness change)

depends on: team-orchestration (merged, PR #29)

## Why

Slice 1 of `team-orchestration`: workers run as background agents in git worktrees, so the
harness hooks must check the **worker's** worktree. A probe run on 2026-11-08 (a background
agent with worktree isolation, Claude Code 2.1.319) showed they don't:

| What                          | Observed                                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Worktree location             | `.claude/worktrees/agent-<id>/`, inside the main checkout, branch `worktree-agent-<id>`                                |
| `$CLAUDE_PROJECT_DIR` (hooks) | the **main checkout**, not the worktree                                                                                |
| PostToolUse on a worker Write | fires                                                                                                                  |
| Lint error in a worker file   | reported (eslint gets the absolute path)                                                                               |
| Type error in a worker file   | **missed** — `tsc` runs in the main checkout; the same `tsc` run from the worktree catches it                          |
| `node_modules` in worktree    | missing; tools still work because Node/npx walk up to the main checkout's — but `ready.mjs` only looks in its own root |
| `.claude/worktrees/`          | not gitignored, so a running worker shows up as an untracked file in the main checkout                                 |
| Stop hook for a worker        | not observable from inside the worker; `settings.json` wires only `Stop`, not `SubagentStop`                           |

So a worker today gets lint feedback but no typecheck, no scope check and no related tests
— exactly the checks that stop it from drifting or guessing.

## What changes

1. Hooks find the repo they are checking from the hook input (`cwd`, or the edited file's
   folder) via `git rev-parse --show-toplevel`, falling back to `$CLAUDE_PROJECT_DIR`.
2. `SubagentStop` runs the same checks as `Stop`, so a worker's turn ends with scope + tests.
3. `ready.mjs` finds `node_modules` the way Node does (nearest one walking up), so a nested
   worktree using the main checkout's install counts as ready.
4. `.gitignore` gets `.claude/worktrees/`.

## Non-goals

- The orchestrator, board, owners, union merge — later slices.
- Worktrees outside the main checkout (not what Claude Code creates).

## Open questions

1. **`node_modules` from the main checkout** — a worker shares the main install, so a task
   that adds a dependency would change it for every worker. Suggested default: fine, since
   a new dependency needs a human OK anyway; the orchestrator (slice 3) runs such a task
   alone.
2. **`SubagentStop` for every subagent** — it also fires for read-only helpers
   (`codebase-explorer`, graphify agents). Suggested default: fine; with no changed files
   the checks exit in well under a second.

## Impact

`.claude/hooks/*.sh`, `.claude/settings.json` (one hook entry), `scripts/harness/ready.mjs`,
`.gitignore`, `DECISIONS.md`. No app code, no new dependency.
