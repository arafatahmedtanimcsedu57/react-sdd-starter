Estimated reviewable lines: ~380 (most of it ported from `chore/harness-clockout-trace`, reviewed in #24)

## 1. Logic (`scripts/harness/lib.mjs`)

- [x] 1.1 Port `findJunk`, `parseTraceLines`, `formatTrace` (with `branch`)
- [x] 1.2 `ownSection(doc, email)`: the `## <email>` section of PROGRESS.md
- [x] 1.3 Tests for 1.1–1.2, ported + new (`scripts/harness/lib.test.mjs`)

## 2. Trace

- [x] 2.1 `.claude/hooks/trace.sh` (port): `run <source> <step> <cmd…>`; writes to the main
      checkout's `.claude/traces/`, adds `branch`
- [x] 2.2 `post-edit.sh`, `stop-check.sh` run their steps through `run`
- [x] 2.3 `io.mjs` `appendTrace` / `readTraces` (same folder rule); `features.mjs` traces verify steps
- [x] 2.4 `scripts/harness/trace.mjs` (port); test: a hook run in a worktree writes to the main folder (`scripts/harness/trace-sh.test.mjs`)

## 3. Clock-out

- [x] 3.1 `scripts/harness/clock-out.mjs` (port) with "your PROGRESS section" and the
      default-branch rule
- [x] 3.2 `package.json` `clock-out`, `trace`; `.gitignore` `.claude/traces/`

## 4. Docs + proof

- [x] 4.1 `CLAUDE.md` clock-out line + Commands line; `DECISIONS.md` entries (crediting #24)
- [x] 4.2 `npm run clock-out` on this branch: ✗ until PROGRESS + commit, then ✓
- [x] 4.3 `npm run check` green; react-reviewer PASS

approved: arafatahmedtanimcsedu57, 2026-11-08
