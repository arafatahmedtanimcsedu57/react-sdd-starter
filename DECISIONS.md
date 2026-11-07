# Decisions

Why things are the way they are, so a later session doesn't undo a deliberate choice or
re-decide it differently. Newest first. One entry per decision: what, why, what was
rejected. Stack-level decisions live in `architecture.md`; this file is for choices made
while building (a library approach, a trade-off, a workaround).

Format:

```
## YYYY-MM-DD: <decision>
- Why: …
- Rejected: <alternative> — <reason>
- Revisit when: … (optional)
```

---

## 2026-11-08: Hooks resolve the checkout from the work, not `$CLAUDE_PROJECT_DIR`

- Why: a worker agent runs in a git worktree at `.claude/worktrees/agent-<id>/`, but Claude
  Code sets `$CLAUDE_PROJECT_DIR` to the main checkout. Every hook `cd`'d there, so a
  worker's type errors, scope drift and failing tests went unreported (probe, Claude Code
  2.1.319). `.claude/hooks/lib.sh` `repo_root` now takes the edited file's folder or the
  hook input `cwd`; `SubagentStop` runs the stop checks; `ready.mjs` uses the nearest npm
  install walking up, so a nested worktree runs on the main checkout's `node_modules`.
- Proof: simulated hooks in a nested worktree catch a type-only error, pass `ready`, and
  fail scope for a file outside the active feature; a live worker showed the hooks enter its
  worktree and a stop hook fires for it with feedback.
- Found: Claude Code creates worker worktrees from the default branch, not the current one.
  Harness fixes reach workers only once merged; a worker always starts from `master`.
- Rejected: symlinking `node_modules` into each worktree — Claude Code creates the worktree,
  we have no step there; `npm ci` per worker — minutes and hundreds of MB each.
- Revisit when: Claude Code exposes the worktree as the project dir for subagents.

## 2026-11-08: Team work runs through one orchestrator per developer, one worker per task

- Why: two developers (Login/Registration vs Dashboard + Profile) each run many tasks in
  parallel. One orchestrator session per developer starts a background worker per task in
  its own git worktree, keeps a board with readable names, and is the only place the owner
  answers questions and approvals. Design: `openspec/changes/team-orchestration/`.
- Human choices: workers start automatically (not terminals opened by hand); Gate 1 is per
  task, not per feature; each developer's PRs are reviewed by the other.
- Rejected: one file per feature/decision for conflict-free state — union merge of the
  ledger and `DECISIONS.md` does the same with far less churn; orchestrators messaging each
  other — git is the only reliable channel between two machines.

## 2026-10-06: Project rules run as ESLint `no-restricted-syntax`, each message with a FIX

- Why: rules that only live in `CLAUDE.md` get missed; a lint error lands in the same turn
  (post-edit hook) and its message tells the agent how to fix it. Covers debug `console`,
  `process.env`, `dangerouslySetInnerHTML`, index keys, `fetch` in UI code, `.only`/`.skip`.
  `scripts/harness/lint-rules.test.mjs` proves each one fires and stays quiet on good code.
- Rejected: `eslint-plugin-react` / `eslint-plugin-vitest` — new dependencies for rules a
  selector already covers; custom `rh rules` regex scanner — a second linter to maintain.
- Limit: selectors match names, so `window.fetch` or a loop variable named `n` as a key slip
  through. Review still matters.

## 2026-10-06: `npm run ready` checks the environment before anything else runs

- Why: a session ended with the Stop hook crashing on `Cannot find package 'zod'` — the
  real causes were Node 20 (engines wants 22/24) and no `node_modules`. `ready.mjs` imports
  only `node:` built-ins, so it explains the problem even when nothing is installed. The Stop
  hook and `npm run check` run it first; the post-edit hook runs it only after a failure.
- Rejected: `engine-strict` in `.npmrc` — only guards `npm install`, not hooks; comparing
  mtimes of the lockfiles — a branch switch touches them without changing anything.
- Note: hooks inherit Claude Code's Node. After fixing Node, restart Claude Code.

## 2026-10-05: Feature state lives in `features.json`, changed only by `npm run features`

- Why: `features.md` is prose for humans; scripts and agents need a list they can read
  (id, proof command, scope, state). A `passing` state must come from a proof command that
  ran, so every change is also appended to `features.ledger.jsonl` and `npm run
harness:check` fails when the two disagree.
- Rejected: a status line inside `features.md` — nothing can enforce it, and the agent
  could mark its own work done.
- Limit: the ledger catches careless hand edits, not a determined one — anything that can
  run Bash can append to it too. The real gate stays CI (`harness:check`) plus the human
  reviewing `features.json` / the ledger in the PR. Proof commands run in a shell, so
  they're limited to runners chained with `&&`; review a changed `verify` like a script.

## 2026-10-05: Scope is checked against the active feature at the end of every turn

- Why: one active feature (WIP=1) only helps if the agent also stays inside that feature's
  folders. The Stop hook runs `npm run scope` so drift is fed back in the same turn.
- Rejected: parsing file names out of `tasks.md` — free text, too easy to misread.

## 2026-10-06: `overrides` points `@vitest/mocker`'s msw peer at the root msw

- Why: vitest 5 bundles `@vitest/mocker`, which still declares the optional peer
  `msw@^2.4.9`. npm 11 (Node 24) accepts msw 3 for it; npm 10 (Node 22, the `node-22` CI
  job) treats the lockfile as out of sync and `npm ci` fails. The override makes both npms
  agree; the lockfile is unchanged and only msw 3 is installed.
- Rejected: `legacy-peer-deps` — hides every peer conflict, not just this one; pinning
  msw back to 2.x — undoes #20; dropping the `node-22` job — weakens CI.
- Revisit when: `@vitest/mocker` declares `msw@^3` — then delete the override.
