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

- `chore/team-orchestrator` (slice 3 of `team-orchestration`, Gate 1 approved):
  `/orchestrate`, `task-worker` agent, `npm run board`, push guard for `@{push}` / `-C`.
  Dry run: a worker drafted a change in its worktree and stopped at Gate 1; the board
  showed it. react-reviewer FAIL → fixed → PASS. PR open; over the size limit.
- Next slice: 4 `team-cross-review` (CI approver ≠ author, CODEOWNERS, `TEAM.md`).
- Harness gaps 3 + 4 (enforced clock-out + junk check; trace of hook/verify runs) still open;
  `.claude/traces/` is untracked and was left alone.

### Known issues

- `.github/workflows/pr-size.yml` excludes `*.test.ts(x)` but not `*.test.mjs`, so harness
  tests count toward the 400-line limit. Fix is a one-line CI change; needs a human OK.
- `guard-bash.sh` still can't see a bare `git push` after `cd <other checkout> &&` (it
  reads the command's `cwd`, not a `cd` inside it). Branch protection is the backstop;
  the orchestrator always pushes with `git -C <worktree> push -u origin <branch>`.
- Not yet run for real: a full feature through `/orchestrate` (only the Gate 1 dry run).

### Next step

- Human: review the slice-3 PR, add `large-pr-approved`, merge. Then slice 4
  `team-cross-review` on its own branch — or first try `/orchestrate` on a real feature.
