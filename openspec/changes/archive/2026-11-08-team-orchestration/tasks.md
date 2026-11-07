Estimated reviewable lines: ~850 — over 400, so this change is split into four slices.
Each slice becomes its own change and PR, in this order. Delivered: slice 1 #30, slice 2 #31, slice 3 #32,
slice 4 #34 (each slice's own change records how its tasks were done). Approving this file approves the
design and the split; each slice's own `tasks.md` still gets its own Gate 1.

## Slice 1 — `team-worktree-spike` (≈80 lines, must pass before the rest)

- [x] 1.1 Start a background agent in a worktree; record whether `Stop` / `SubagentStop`
      hooks fire and what `$CLAUDE_PROJECT_DIR` points at (`.claude/hooks/*.sh`)
- [x] 1.2 If they point at the main checkout: make the hooks resolve the repo from `git
rev-parse --show-toplevel` of the working directory instead
- [x] 1.3 Test: a worker editing outside its scope gets the scope error in its own turn
- [x] 1.4 Write the result in `DECISIONS.md`

## Slice 2 — `team-merge-safe-state` (≈250 lines)

- [x] 2.1 `owner` on every feature; `npm run features -- add --owner <email>` (`scripts/harness/features.mjs`)
- [x] 2.2 Feature state replayed from the ledger; `features.json` keeps definitions only (`lib.mjs`, `io.mjs`)
- [x] 2.3 `.gitattributes`: `features.ledger.jsonl` and `DECISIONS.md` → `merge=union`
- [x] 2.4 WIP=1 per worktree + per-owner cap; scope taken from the branch's change (`scope.mjs`)
- [x] 2.5 `PROGRESS.md` auto block grouped by owner, no branch line (`progress.mjs`)
- [x] 2.6 Tests: two branches appending to the ledger merge cleanly and replay the same;
      start refuses a second active task in one worktree; scope uses the change's folders
      (`lib.test.mjs`)

## Slice 3 — `team-orchestrator` (≈350 lines)

- [x] 3.1 `/orchestrate [feature]` command (`.claude/commands/orchestrate.md`)
- [x] 3.2 `task-worker` agent definition with the brief template and the STATUS line (`.claude/agents/task-worker.md`)
- [x] 3.3 `npm run board` — board from `board.json` + worktrees + openspec + `gh pr list` (`scripts/harness/board.mjs`)
- [x] 3.4 Scheduler rules: deps, folder overlap, worker cap (`scripts/harness/lib.mjs`)
- [x] 3.5 `.gitignore`: `.claude/orchestra/`, `.claude/traces/`, `graphify-out/`
- [x] 3.6 Tests: board rendering, scheduler picks/queues correctly, STATUS parsing (`lib.test.mjs`)

## Slice 4 — `team-cross-review` (≈170 lines)

- [x] 4.1 CI: approving review from someone other than the PR author (`.github/workflows/ci.yml`)
- [x] 4.2 CODEOWNERS with both developers (`.github/CODEOWNERS`)
- [x] 4.3 `CLAUDE.md` (seven commands, orchestrator rules), `PIPELINE.md`, README "Working as a team"
- [x] 4.4 Test: CI step fails on a self-approved PR (workflow dry run with `act` or a fixture)

approved: arafatahmedtanimcsedu57, 2026-11-08
