Estimated reviewable lines: ~280

## 1. Logic (`scripts/harness/lib.mjs`)

- [ ] 1.1 Schema v2: definitions + `owner` + `limits`; state out of `features.json`
- [ ] 1.2 `featureStates(list, ledger)` replay: state, attempts (`verify_failed` since start), evidence, blockedReason
- [ ] 1.3 Transitions check owner and `activePerOwner` instead of global WIP=1
- [ ] 1.4 Definition drift (scope, owner) checked against ledger lines
- [ ] 1.5 `scopeForBranch(changedFiles, changes, features, me)`
- [ ] 1.6 `renderProgress` grouped by owner (print only)
- [ ] 1.7 Tests for 1.1–1.6, including union-merge replay order (`scripts/harness/lib.test.mjs`)

## 2. CLIs (`scripts/harness/`)

- [ ] 2.1 `io.mjs`: `me()` from `git config user.email`; ledger lines get `by`
- [ ] 2.2 `features.mjs`: `add --owner`, owner checks, `verify_failed` lines, new `owner` command
- [ ] 2.3 `scope.mjs`: uses `scopeForBranch`
- [ ] 2.4 `progress.mjs`: prints; `harness:check` fails on old generated markers in `PROGRESS.md`

## 3. Migration + config

- [ ] 3.1 `features.json` → v2, owner ledger lines for F01/F02
- [ ] 3.2 `.gitattributes` (new): ledger + `DECISIONS.md` → `merge=union`
- [ ] 3.3 `PROGRESS.md` → one section per owner
- [ ] 3.4 `openspec/config.yaml`: "Feature: none" for harness/docs changes
- [ ] 3.5 Test: real `git merge` of two branches appending ledger lines + DECISIONS entries has no conflict (`scripts/harness/merge.test.mjs`)

## 4. Docs

- [ ] 4.1 `CLAUDE.md` → Feature list + Sessions: owners, WIP per owner, progress per owner
- [ ] 4.2 `PIPELINE.md`, `README.md` rows for `features.json` / `PROGRESS.md`
- [ ] 4.3 `DECISIONS.md` entry
- [ ] 4.4 `npm run check` green; react-reviewer PASS

approved: <pending>
