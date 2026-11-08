# Design — progress/<id>.md

No UI.

- `progressFile(me)` = `progress/${me.github ?? me.email}.md` (lowercase).
- `checkProgressFile(text)` → missing headings (Current work, Known issues, Next step);
  clock-out fails on them.
- `clock-out`: the "PROGRESS saved" rule reads `progress/<id>.md` now vs. at the branch
  base (`git show <base>:<file>`), same logic as `ownSection` today; missing file → FIX
  prints `mkdir -p progress && cp progress/_template.md progress/<id>.md`.
- `progress.mjs`: lists the `progress/*.md` names; `-- migrate` plans every move first
  (two sections → one file: fail, nothing written), skips a file that already exists
  (warns; its section stays in `PROGRESS.md` to merge by hand), and leaves the shared part.
  A section ends at the next `#`/`##` heading or `---`; code fences are ignored.
- `instructions.mjs`: `PROGRESS.md` containing a `## @login` / `## <email>` heading → fail
  with "run npm run progress -- migrate".
- `join`: create `progress/<login>.md` from `progress/_template.md` if missing; if
  `progress/<email>.md` exists, rename it (`renameSync`, which also works for an uncommitted
  file; the message names both sides to commit); both exist → warn.
- `clock-out`: joined but only the email file on this branch → FIX `git mv <email> <login>`.
- `ALWAYS_IN_SCOPE` gains `progress/` (replaces nothing; `PROGRESS.md` stays).

## Rejected

- **Union-merge `PROGRESS.md`** — two edits to one line would both survive, silently.
- **Sections sorted alphabetically** — still a conflict when two names land next to each
  other.
- **Progress in the ledger** — prose doesn't belong in an append-only machine log.
