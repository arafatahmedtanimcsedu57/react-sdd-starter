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
