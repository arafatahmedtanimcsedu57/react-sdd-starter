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

- **Kickoff plan (2026-11-08)** — approved by the lead. Open questions live in each
  `features.md` entry; settle them in that feature's `/orchestrate` before its UI tasks.

  | Feature                      | Size  | Depends on          | Owner                    | Start |
  | ---------------------------- | ----- | ------------------- | ------------------------ | ----- |
  | F03 Sign in and registration | L (3) | —                   | @arafatahmedtanimcsedu57 | 1     |
  | F04 Dashboard                | M (2) | F03's contract task | @x-dev                   | 2     |
  | F05 Profile                  | M (2) | F03's contract task | @x-dev                   | 2     |
