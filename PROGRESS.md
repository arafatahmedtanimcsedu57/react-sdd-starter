# Progress

The handoff note between sessions. Treat every session as a new engineer with no memory:
**clock in** with `npm run progress` (features by owner, open changes), then read **your**
section below + `DECISIONS.md`; **clock out** by updating your section (see `CLAUDE.md` →
Sessions).

One section per developer, headed by their git email (`git config user.email`). Edit only
your own: two developers editing different sections merge without conflicts.

## Team-wide known issues

Things that affect everyone. Add, don't rewrite.

- The ledger stops careless hand edits, not determined ones (see `DECISIONS.md`); CI's
  `harness:check` + PR review of `features.json` / the ledger are the real gate.
- Hooks use the Node Claude Code was started with. If `ready` says the Node is wrong after
  `nvm alias default 24`, restart Claude Code.
- CI's quality job lists its steps itself, so it doesn't run `npm run ready` (setup-node
  already pins Node there).
- Claude Code creates worker worktrees from `master`, not the current branch, so a harness
  fix reaches workers only after it is merged.

## arafatahmedtanimcsedu57@gmail.com

### Current work

- `chore/team-merge-safe-state` (slice 2 of `team-orchestration`, Gate 1 approved): owners,
  state only in the ledger, union merge for the ledger + `DECISIONS.md`, WIP per owner,
  scope per branch, this per-owner `PROGRESS.md`.
- Slice 1 confirmed on `master`: a live worker got "Typecheck failed" and the scope error
  inside its own worktree.
- Harness gaps 3 + 4 (enforced clock-out + junk check; trace of hook/verify runs) still open;
  `.claude/traces/` is untracked and was left alone.

### Known issues

- Open (reviewer question): a worker branch tracking `origin/master` with
  `push.default=upstream` could make a bare `git push` target master; `guard-bash.sh` only
  checks the current branch name. Branch protection is the backstop. Decide in slice 3.

### Next step

- Human: review and merge the slice-2 PR. Then slice 3 `team-orchestrator` on its own branch.
