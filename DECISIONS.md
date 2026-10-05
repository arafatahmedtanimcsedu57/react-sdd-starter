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
