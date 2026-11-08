Risk tier: medium

Feature: none (harness change)

## Why

`PROGRESS.md` holds one section per developer. Editing different sections merges fine,
but **adding** a section doesn't: every new section is appended at the end of the file, so
two people adding theirs the same day conflict (simulation S8, 2026-11-08). It happens
whenever the team grows, and the handoff note is the one file every session must update.

## What changes

1. **One file per person**: `progress/<id>.md`, where `<id>` is your GitHub login once you
   have joined (`progress/ana-dev.md`), else your git email (`progress/ana@x.io.md`). Same
   three headings: Current work, Known issues, Next step. Nobody else edits it, so it can't
   conflict.
2. **`PROGRESS.md` stays** as the shared page: what the file is for, **Team-wide known
   issues**, the kickoff plan, and a pointer to `progress/`. Its per-person sections move out.
3. **Clock-in / clock-out follow:** `npm run progress` prints whose files exist and points
   you at yours; `npm run clock-out` checks **your file** changed on a branch with changes
   (today: your section) and offers the exact path when it's missing.
4. **`npm run team -- join`** creates your file if it doesn't exist (you're the only one
   writing it, in your own join PR). `/kickoff` writes one per new member.
5. **Migration:** a `## <name>` section still in `PROGRESS.md` is moved once with
   `npm run progress -- migrate` (each section → its file); `harness:check` flags sections
   left behind.
6. Docs: `CLAUDE.md` (Sessions), `TEAM.md`, `/orchestrate` + `/kickoff` clock-out lines,
   `DECISIONS.md`.

## Not in this change

- Team-wide known issues stay one shared list (rarely edited; additions to the end can
  still conflict, resolved by keeping both).

## Open questions

1. **File name** — suggested default: login when joined, else email; a rename on join is
   done by `join` (moves `progress/<email>.md` → `progress/<login>.md`).
2. **Migration** — suggested default: an explicit `npm run progress -- migrate`, run once
   by whoever lands this, not automatic in every command.
3. **Size** — ~200 reviewable lines: one PR. Built after #40 (team-scale) merges, since both
   touch `lib.mjs` and `PROGRESS.md`.

## Impact

`scripts/harness/{lib,io,progress,clock-out,roster,instructions}.mjs` + tests,
`PROGRESS.md`, `progress/` (new), `CLAUDE.md`, `TEAM.md`, `.claude/commands/{orchestrate,kickoff}.md`,
`DECISIONS.md`. No new dependency.
