# Progress

The team-wide part of the handoff note. Treat every session as a new engineer with no
memory: **clock in** with `npm run progress` (features by owner, open changes), then read
**your** file + this page + `DECISIONS.md`; **clock out** by updating your file (see
`CLAUDE.md` → Sessions).

Each developer's own notes live in `progress/<login>.md` (or `progress/<email>.md` before
`npm run team -- join`), from `progress/_template.md`. Only you edit yours, so they never
conflict. A `## @login` / `## <email>` section here fails `harness:check`.

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
