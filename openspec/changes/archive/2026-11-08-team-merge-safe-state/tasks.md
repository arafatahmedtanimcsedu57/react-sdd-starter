Estimated reviewable lines: ~280

## 1. Logic (`scripts/harness/lib.mjs`)

- [x] 1.1 Schema v2: definitions + `owner` + `limits`; state out of `features.json`
- [x] 1.2 `featureStates(list, ledger)` replay: state, attempts (`verify_failed` since start), evidence, blockedReason
- [x] 1.3 Transitions check owner and `activePerOwner` instead of global WIP=1
- [x] 1.4 Definition drift (scope, owner) checked against ledger lines
- [x] 1.5 `scopeForBranch(changedFiles, changes, features, me)`
- [x] 1.6 `renderProgress` grouped by owner (print only)
- [x] 1.7 Tests for 1.1–1.6, including union-merge replay order (`scripts/harness/lib.test.mjs`)

## 2. CLIs (`scripts/harness/`)

- [x] 2.1 `io.mjs`: `me()` from `git config user.email`; ledger lines get `by`
- [x] 2.2 `features.mjs`: `add --owner`, owner checks, `verify_failed` lines, new `owner` command
- [x] 2.3 `scope.mjs`: uses `scopeForBranch`
- [x] 2.4 `progress.mjs`: prints; `harness:check` fails on old generated markers in `PROGRESS.md`

## 3. Migration + config

- [x] 3.1 `features.json` → v2, owner ledger lines for F01/F02
- [x] 3.2 `.gitattributes` (new): ledger + `DECISIONS.md` → `merge=union`
- [x] 3.3 `PROGRESS.md` → one section per owner
- [x] 3.4 `openspec/config.yaml`: "Feature: none" for harness/docs changes
- [x] 3.5 Test: real `git merge` of two branches appending ledger lines + DECISIONS entries has no conflict (`scripts/harness/merge.test.mjs`)

## 4. Docs

- [x] 4.1 `CLAUDE.md` → Feature list + Sessions: owners, WIP per owner, progress per owner
- [x] 4.2 `PIPELINE.md`, `README.md` rows for `features.json` / `PROGRESS.md`
- [x] 4.3 `DECISIONS.md` entry
- [x] 4.4 `npm run check` green; react-reviewer PASS

approved: arafatahmedtanimcsedu57, 2026-11-08
