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

## 2026-10-06: Hook and verify steps are traced to `.claude/traces/<day>.jsonl`

- Why: the ledger records state moves, not what ran. When a Stop hook or `features verify`
  failed, nothing showed which step failed, when, or how long it took. One JSON line per
  step (source, step, exit, ms) is cheap; `npm run trace -- --failed` reads it back.
- Rejected: committing traces — noisy diffs and merge conflicts for local evidence; logging
  full command output — large, and the hook already feeds it back in the turn.
- Revisit when: autopilot runs need a post-mortem — upload the folder as a CI artifact.

## 2026-10-06: Clock-out is a command (`npm run clock-out`), not only a checklist

- Why: "no debug code or stray files, PROGRESS.md updated, committed" was prose in
  CLAUDE.md, so it got skipped. The command checks it and names the fix. `--fix` deletes
  only untracked junk (`*.log`, `debug-*`, `*.orig` …); code leftovers are reported, never
  edited. It does not re-run `npm run check` — a known red check written under Known
  issues must not make a clean handoff impossible.
- Rejected: running it in the Stop hook — that fires every turn, clock-out is per session.

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
