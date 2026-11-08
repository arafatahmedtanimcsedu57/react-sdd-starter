# Design — progress/<id>.md

No UI.

- `progressFile(me)` = `progress/${me.github ?? me.email}.md` (lowercase).
- `checkProgressFile(text)` → missing headings (Current work, Known issues, Next step).
- `clock-out`: the "PROGRESS saved" rule reads `progress/<id>.md` now vs. at the branch
  base (`git show <base>:<file>`), same logic as `ownSection` today; missing file → FIX
  prints `mkdir -p progress && cp progress/_template.md progress/<id>.md`.
- `progress.mjs`: lists `progress/*.md` (owner, first "Next step" line); `-- migrate` splits
  `PROGRESS.md` sections by `## <name>` into files, leaves the shared part.
- `instructions.mjs`: `PROGRESS.md` containing a `## @login` / `## <email>` heading → fail
  with "run npm run progress -- migrate".
- `join`: create `progress/<login>.md` from `progress/_template.md` if missing; if
  `progress/<email>.md` exists, `git mv` it.
- `ALWAYS_IN_SCOPE` gains `progress/` (replaces nothing; `PROGRESS.md` stays).

## Rejected

- **Union-merge `PROGRESS.md`** — two edits to one line would both survive, silently.
- **Sections sorted alphabetically** — still a conflict when two names land next to each
  other.
- **Progress in the ledger** — prose doesn't belong in an append-only machine log.
