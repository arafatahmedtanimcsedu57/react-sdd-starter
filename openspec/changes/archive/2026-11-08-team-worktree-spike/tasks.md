Estimated reviewable lines: ~90

## 1. Probe (done 2026-11-08, findings in `proposal.md`)

- [x] 1.1 Start a background agent in a worktree; record hook behaviour and `$CLAUDE_PROJECT_DIR`

## 2. Fix

- [x] 2.1 `repo_root` helper (`.claude/hooks/lib.sh`)
- [x] 2.2 `post-edit.sh` resolves the root from the edited file's folder
- [x] 2.3 `stop-check.sh` and `guard-bash.sh` resolve the root from the hook input `cwd`
- [x] 2.4 `SubagentStop` → `stop-check.sh` (`.claude/settings.json`)
- [x] 2.5 `ready.mjs` finds the nearest `node_modules` walking up (`scripts/harness/ready.mjs`, `env.mjs`)
- [x] 2.6 `.claude/worktrees/` in `.gitignore`

## 3. Prove

- [x] 3.1 Unit test: upward `node_modules` lookup (`scripts/harness/env.test.mjs`)
- [x] 3.2 Re-run the probe: type error reported in the worker; scope error on worker stop;
      main checkout `git status` clean while it runs — results in `DECISIONS.md`
- [x] 3.3 `npm run check` green

approved: arafatahmedtanimcsedu57, 2026-11-08
