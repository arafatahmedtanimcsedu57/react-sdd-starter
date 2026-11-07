Risk tier: high

Feature: none (harness change)

depends on: team-worktree-spike (merged, PR #30)

## Why

Slice 2 of `team-orchestration`. With two developers, every PR touches the same harness
files, and the harness assumes one person:

- `features.json` stores each feature's **state** (plus attempts, evidence), so every
  `start` / `verify` on any branch edits it → conflicts on every pair of PRs.
- `features.ledger.jsonl` is append-only, but two branches appending at the end still
  conflict; a hand-resolved conflict then fails the replay check as "edited by hand".
- WIP=1 is global: "one active feature in the repo". You (Login/Registration) and X
  (Dashboard, Profile) each need theirs active at once, and X owns two.
- The scope check uses "the" active feature — with two active, it picks the wrong one.
- `PROGRESS.md`'s generated block holds the branch name and counts, so every clock-out
  rewrites the same lines; one "Current work / Next step" for the whole team.
- `DECISIONS.md` entries are inserted at the same spot by everyone.

## What changes

1. **Owners.** Every feature has an `owner` (git email). Only its owner can `start`,
   `block` or `verify` it. Existing F01, F02 → `arafatahmedtanimcsedu57@gmail.com`.
2. **State lives only in the ledger.** `features.json` keeps definitions (id, title, owner,
   verify, scope); state, attempts and evidence are replayed from `features.ledger.jsonl`.
   Every ledger line also records `by` (git email).
3. **Ledger and `DECISIONS.md` merge by union** (`.gitattributes`), so parallel appends and
   inserts never conflict.
4. **WIP per owner, scope per branch.** An owner may have up to `activePerOwner` features
   active (default 2). The scope check uses the feature of the OpenSpec change this branch
   builds (its `proposal.md` "Feature:" line), else the current developer's active features.
5. **`PROGRESS.md` per owner.** The generated summary is printed by `npm run progress`
   (grouped by owner) instead of being written into the file; the file keeps one
   hand-written section per owner.

## Non-goals

- The orchestrator, board, worker agent (slice 3); cross-review CI (slice 4).
- Task-level scope narrower than the feature (a task uses its feature's scope for now).
- Preventing someone from faking `git config user.email`. Owners stop mistakes; PR review
  of the ledger stays the real gate (as today).

## Open questions

1. **Active features per owner** — suggested default: 2 (X owns Dashboard and Profile).
   Tasks are where parallelism happens; this only caps how many features one person has
   open. Stored in `features.json` as `"limits": { "activePerOwner": 2 }`.
2. **Two people adding features at the same time** — `features.json` definitions can still
   conflict (both append to the array). Suggested default: accept it; adding a feature is
   rare and the conflict is a plain "keep both". The ledger side merges cleanly.
3. **PROGRESS.md generated block** — suggested default: remove it from the file (print
   only). Alternative rejected below: a custom git merge driver every clone must install.

## Impact

`scripts/harness/{lib,io,features,scope,progress}.mjs` + tests, `features.json` (format v2),
`features.ledger.jsonl` (migration lines), `.gitattributes` (new), `PROGRESS.md`,
`openspec/config.yaml` (proposal rule), `CLAUDE.md` (Feature list wording),
`PIPELINE.md`, `README.md`. No app code, no new dependency.
