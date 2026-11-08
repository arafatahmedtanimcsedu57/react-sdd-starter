# Decisions

Why things are the way they are, so a later session doesn't undo a deliberate choice or
re-decide it differently. Newest first. One entry per decision: what, why, what was
rejected. Stack-level decisions live in `architecture.md`; this file is for choices made
while building (a library approach, a trade-off, a workaround).

**Append-only.** This file merges by union (`.gitattributes`), which keeps both sides when
two branches add entries — but also when two branches edit the _same_ line, silently. So
never edit an existing entry: supersede it with a new one ("Supersedes: 2026-10-05 …").

Format:

```
## YYYY-MM-DD: <decision>
- Why: …
- Rejected: <alternative> — <reason>
- Revisit when: … (optional)
```

---

## 2026-11-08: Team-scale rules, from a simulated 7-person team

- Why: a scripted team (bare repo as GitHub, a clone per developer, CI-checked merges)
  showed a repeated `start` on two branches turning master red, nobody able to reassign a
  departed member's feature, colliding ids, and CODEOWNERS conflicts that silently drop a
  reviewer. Now: repeated moves are ignored, over-limit warns, leads (recorded in the
  ledger like joins, replayed per line; mirrored in `team.json`) hand over with `--reason`, `features add` picks an id free on every pushed branch, and
  `harness:check` fails on an incomplete CODEOWNERS. `team-sim.test.mjs` replays it.
  A roster that already had several joins gets its earliest joiner as lead; correct it
  with `npm run team -- lead @x` (and `--remove`).
- Rejected: failing master when someone is over the limit — one overlap blocks every PR;
  a central id counter file — it conflicts exactly like `features.json`; union-merging
  `PROGRESS.md` — two edits to one line would both survive (per-person files: later);
  leads read from today's `team.json` — a departed lead's old hand-overs would fail master.

## 2026-11-08: `/kickoff` + a team roster; owners may be a GitHub `@login`

- Why: a lead has a PRD / demo / feature list and GitHub usernames, not teammates' git
  emails. `team.json` lists members by login; each member links their own email with
  `npm run team -- join`, which is also logged in the ledger, so a hand-edited email is
  drift. `/kickoff` drafts features and proposes a split (whole features per person); the
  lead approves both before anything is written. Tasks stay with each owner's `/orchestrate`.
- Rejected: GitHub login as the only identity — every command would need `gh` and the
  ledger a migration; the lead typing teammates' emails — a wrong one silently hands a
  feature to someone else; folding into `/start` — it runs once, PRDs and people change;
  assigning tasks at kickoff — task-level owners don't exist.
- `team.json` and `.github/CODEOWNERS` are always in scope (like `features.json`), so a
  re-run of `/kickoff` while the lead has an active feature passes the scope check.
  Rejected: skipping the scope check on `chore/kickoff-*` branches — a branch name would
  switch off the whole check.
- Limit: not authentication. A hand-written join line plus a matching `team.json` edit
  passes the checks; PR review of `team.json` + the ledger is the gate.

## 2026-11-08: Clock-out is a command and hook steps are traced (port of #24)

- Why: "no junk, PROGRESS.md updated, committed" was prose and got skipped, and when a hook
  or `features verify` failed nothing showed which step failed or when. `npm run clock-out`
  checks it and names each fix (`--fix` deletes only untracked junk — never code);
  `.claude/hooks/trace.sh` and `features verify` append one JSON line per step, read with
  `npm run trace [-- --failed]`. Built and reviewed on 2026-10-06 in #24, which was merged
  into its stacked base branch and never reached `master`; ported here.
- Changed in the port: clock-out checks the caller's own `## <email>` section of
  `PROGRESS.md`; it passes on the default branch with a clean tree (orchestrator sessions);
  traces from every worker worktree go to the main checkout's `.claude/traces/`, tagged
  with the branch, so they survive the worktree's removal.
- Rejected: clock-out in the Stop hook — it fires every turn, clock-out is per session;
  committing traces — noisy diffs for local evidence; re-running `npm run check` inside
  clock-out — a known red check written under Known issues must not block a handoff.
- Lesson: a PR stacked on another branch merges into that branch. Retarget it to the
  default branch before merging, or it never ships.

## 2026-11-08: Gate 2 is enforced by branch protection, verified by `npm run team:check`

- Why: GitHub never lets a PR's author approve it, so "reviewed by the other developer"
  only needs protection that requires an approving code-owner review on the latest push.
  `team:check` reads the protection, collaborators and CODEOWNERS (read-only `gh`) and
  names every missing rule with its fix; `/orchestrate` runs it at clock-in.
- Found: this repo's `master` had **no** protection and no rulesets (team:check: 9 of 10
  rules missing). Earlier PRs called branch protection "the backstop" for local guard
  gaps — it wasn't there. `TEAM.md` §6 has the one admin command; apply it only after the
  teammate is a collaborator and in CODEOWNERS, or nobody can approve the only owner's PRs.
- Also: the PR size check now excludes `*.test.mjs`, as CLAUDE.md always said for tests.
- Rejected: a CI job requiring a non-author approval — duplicates GitHub and can't block
  a merge itself; applying protection from the harness — an admin decision, and
  `guard-bash.sh` blocks protection writes on purpose; `team:check` in `npm run check` — CI
  tokens can't read protection.

## 2026-11-08: The orchestrator reviews, pushes and opens PRs; workers only build and commit

- Why: `/orchestrate` runs one `task-worker` per task in its own worktree. A subagent can't
  start another subagent (no `react-reviewer` from a worker), and a background agent can't
  answer permission prompts (`git push`, `gh pr create` are "ask"). So a worker stops at
  `ready`; the orchestrator, in the owner's window, reviews, pushes and opens the PR. The
  orchestrator also writes every `approved:` line, only on the owner's words.
- Board: local `.claude/orchestra/board.json`, one writer (`npm run board`), rebuilt from
  workers' `STATUS:` lines. `ready` / `pr-open` tasks keep their folders until merged, so
  no new task edits the same files. Only a feature's first task writes `features
add/start`; a closing PR writes `verify` — two branches never move one feature.
- Dry run: a worker drafted a contract task in its worktree, stopped at Gate 1 with a valid
  STATUS line, touched no ledger file; the board showed it under "Needs you". It also
  showed that task folders must be folders including tests and shared registration files
  (`src/mocks/handlers.ts`, …) — now in the planning step.
- Rejected: workers pushing / opening PRs themselves (permission prompts nobody sees);
  workers writing the board (parallel writers to one file); every task running
  `features start` (forked ledger history).

## 2026-11-08: Feature state lives only in the ledger, which merges by union; features have owners

- Why: with two developers every `start` / `verify` edited `features.json` and every PR
  conflicted there and at the end of the ledger. Now `features.json` holds definitions
  (id, title, owner, proof, scope) and changes rarely; state, attempts and evidence are
  replayed from `features.ledger.jsonl`, which `.gitattributes` merges by union (also
  `DECISIONS.md`). Replay is per feature, so line order from two owners doesn't matter.
  Global WIP=1 became "only the owner moves a feature, max `limits.activePerOwner` (2)";
  the scope check uses the feature of the change this branch builds. `PROGRESS.md` lost
  its generated block (printed by `npm run progress` now) and has one section per owner.
- Proof: `merge.test.mjs` runs a real `git merge` of two branches that append ledger lines
  and add decisions — it conflicts without the attributes and merges cleanly with them.
- Rejected: one file per feature / decision — new top-level folders, every script
  rewritten; a custom merge driver for `PROGRESS.md` — every clone must install it, and a
  missing one silently falls back to a conflicting merge; keeping global WIP=1.
- Limit: two developers adding a feature at the same moment can still conflict in
  `features.json` (both append to the array) — keep both. Two branches both running `scope`/`owner` on one
  feature: after keeping both in `features.json`, the owner re-runs the command for the
  side the ledger lost, so a fresh line matches. `features check` also rejects ledger lines
  the CLI wouldn't write (wrong `from`, no evidence, not the owner, a forked history). Owner checks trust
  `git config user.email`; PR review of the ledger is the real gate.
- Unverified: whether GitHub's own merge button honours `merge=union`. If a PR shows a
  conflict in the ledger or `DECISIONS.md`, `git merge origin/master` locally (it does)
  and push.

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
