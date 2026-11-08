# Progress

The handoff note between sessions. Treat every session as a new engineer with no memory:
**clock in** with `npm run progress` (features by owner, open changes), then read **your**
section below + `DECISIONS.md`; **clock out** by updating your section (see `CLAUDE.md` →
Sessions).

One section per developer, headed by their `@login` or git email (`git config
user.email`). Edit only your own: two developers editing different sections merge without
conflicts.

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

- team-kickoff shipped (#37 roster + `@login` owners, #38 `/kickoff`); archived to
  `openspec/changes/archive/2026-11-08-team-kickoff/`. Not yet run for real with a teammate.

### Known issues

- **`master` is not protected** (`npm run team:check`: 9 of 10 rules missing). Until it is,
  Gate 2 isn't enforced on GitHub. Order: add the teammate as a collaborator → add them to
  every CODEOWNERS line and merge → run the command in `TEAM.md` §6.
- `guard-bash.sh` still can't see a bare `git push` after `cd <other checkout> &&`;
  branch protection is the backstop once it's on.
- Not yet run for real: a full feature through `/orchestrate` (only the Gate 1 dry run).

### Next step

- Human: `/kickoff <PRD | demo URL | feature list>` with the teammate's GitHub name (adds
  them to `team.json` + CODEOWNERS); add them as a collaborator (TEAM.md §1); after that
  merges, turn on protection (§6) → `npm run team:check` green. Teammate: `npm run team --
join`, then `/orchestrate <their feature>`.
