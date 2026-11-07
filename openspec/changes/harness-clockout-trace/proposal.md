Risk tier: medium

Feature: none (harness change)

## Why

Harness gaps 3 and 4 were built and reviewed on 2026-10-06 (PR #24) but **never reached
`master`**: #24 was stacked on `chore/harness-env-and-rules` and merged into that branch
after #22 had already merged it to `master`. Its work survives only on
`chore/harness-clockout-trace`. Meanwhile the harness changed under it (owners,
ledger-only state, per-owner `PROGRESS.md`, worker worktrees), so it can't be merged as is.

- **Gap 3 — clock-out is prose.** "No debug code or stray files, PROGRESS.md updated,
  committed" lives in CLAUDE.md and gets skipped.
- **Gap 4 — no record of what ran.** When a Stop hook or `features verify` failed, nothing
  shows which step failed, when, or how long it took.

## What changes

1. **`npm run clock-out`** (port of #24): environment ready; no untracked junk (`*.log`,
   `debug-*`, `*.orig` … — `--fix` deletes only those); no lint leftovers in changed code;
   **your** `PROGRESS.md` section updated when the branch changes files; everything
   committed on a feature branch. Never edits code.
2. **`npm run trace`** + `.claude/hooks/trace.sh` (port of #24): every hook step and every
   `features verify` / `clock-out` step appends one JSON line (source, step, exit, ms,
   branch) to `.claude/traces/<UTC day>.jsonl`; `npm run trace -- --failed` reads it back.
3. **Adapted to today's harness:**
   - "progress saved" checks the caller's own `## <git email>` section, not the removed
     generated block;
   - traces from every worker worktree land in the **main checkout's** `.claude/traces/`,
     tagged with `branch`, so they survive the worktree being removed;
   - on the default branch with a clean tree, clock-out passes (an orchestrator session
     has nothing to hand off) instead of always failing;
   - `features verify` tracing re-applied to the new `features.mjs`.
4. CLAUDE.md clock-out line names the command; `.gitignore` gets `.claude/traces/`.

## Non-goals

- Running clock-out in the Stop hook (it fires every turn; clock-out is per session).
- Committing traces or uploading them from CI.
- Workers running clock-out — they commit before every stop and never edit `PROGRESS.md`;
  their hook steps are traced like any other.

## Open questions

1. **Traces location** — suggested default: the main checkout (parent of the shared
   `.git`), one folder for all worktrees, each line tagged with its branch.
2. **Clock-out on the default branch** — suggested default: ✓ when the tree is clean,
   ✗ ("switch to a branch") when there are changes.
3. **The untracked `.claude/traces/2026-10-06.jsonl`** (test data from #24) — suggested
   default: leave it; it becomes ignored and `npm run trace -- --day 2026-10-06` can read
   it.

## Impact

`scripts/harness/{clock-out,trace}.mjs` (new), `lib.mjs`, `io.mjs`, `features.mjs` + tests,
`.claude/hooks/{trace.sh (new),post-edit.sh,stop-check.sh}`, `.gitignore`, `package.json`,
`CLAUDE.md` (2 lines), `DECISIONS.md`. No app code, no new dependency.
