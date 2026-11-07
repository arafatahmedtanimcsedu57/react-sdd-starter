Estimated reviewable lines: ~380 (plus ~200 test lines CI currently also counts)

## 1. Logic (`scripts/harness/lib.mjs`)

- [x] 1.1 Board schema (Zod) + `parseStatus(text)` for the STATUS line
- [x] 1.2 `runnableTasks(board, config)`: deps, contract-only deps, folder overlap, worker cap
- [x] 1.3 `renderBoard(board, prs)`: groups by feature, readable names, "Needs you" queue
- [x] 1.4 Tests for 1.1–1.3 (`scripts/harness/board.test.mjs`, `board.cli.test.mjs`)

## 2. CLI

- [x] 2.1 `scripts/harness/board.mjs`: print, `add`, `set`, `next`; `.claude/orchestra/board.json`
- [x] 2.2 `.claude/orchestra.json` (`maxWorkers: 4`), `.gitignore` `.claude/orchestra/`, `package.json` `board` script

## 3. Agents + command

- [x] 3.1 `.claude/agents/task-worker.md`: the worker's rules, brief contract, STATUS line
- [x] 3.2 `.claude/commands/orchestrate.md`: plan → start → gate 1 → relay → merge → close → resume

## 4. Guard

- [x] 4.1 `guard-bash.sh`: bare push whose `@{push}` is the default branch is blocked
- [x] 4.2 Test: hook simulation with a branch tracking `origin/master` and `push.default=upstream`

## 5. Docs + proof

- [x] 5.1 `CLAUDE.md`: seven commands; OpenSpec name mapping → `.claude/rules/commands.md`
- [x] 5.2 `PIPELINE.md`, `README.md`: "Working as a team" with `/orchestrate`
- [x] 5.3 Dry run: `/orchestrate` on a throwaway feature plans 2 tasks, starts 1 worker, the
      worker stops at Gate 1 with a STATUS line, the board shows "Needs you" — then clean up
- [ ] 5.4 `DECISIONS.md` entry; `npm run check` green; react-reviewer PASS

approved: arafatahmedtanimcsedu57, 2026-11-08
