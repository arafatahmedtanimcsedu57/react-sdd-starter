Risk tier: medium

Feature: none (harness change)

## Why

A team starting a project with this harness has product input in some form — a PRD, a
demo frontend, a feature list — and a list of people. Today nothing turns that into work:
`/start` drafts 1–3 features by asking questions, features are owned by a **git email**
nobody knows in advance, and splitting features among people is done by hand. The flow a
lead wants:

1. clone + set up → 2. hand the harness the PRD / demo link / feature list →
2. list the team by GitHub name → 4. get a feature list → 5. split it among the team.

## What changes

1. **`/kickoff [PRD path | demo URL | feature list]`** — an eighth human command, repeatable
   (project start, a new PRD version, a new teammate). It reads the input, drafts
   `features.md` entries, takes the team's GitHub names, **proposes a split** of features to
   people, and — only after the lead approves both — writes everything in one kickoff PR.
2. **Team roster** — committed `team.json`: each member's GitHub login, and their git email
   once they join. `npm run team` lists members and what each owns.
   - `npm run team -- add @login` (lead) / `npm run team -- join` (each teammate, once:
     reads their login with `gh` and their `git config user.email`).
   - `npm run team -- codeowners` writes `.github/CODEOWNERS` from the roster (every line
     names every member, so anyone but the author can review).
3. **Owners can be GitHub logins.** A feature's `owner` may be `@login`; the harness
   resolves the caller through the roster (`git email → @login`). Existing email owners keep
   working. `PROGRESS.md` sections may be headed `## @login`.
4. **Setup check per teammate** — `npm run team -- join` also runs `npm run ready` and
   `npm run team:check`, and prints the next step (`/orchestrate <your feature>`).

Granularity: kickoff assigns **whole features** to people. Each owner's `/orchestrate`
splits their feature into tasks, as today.

## Decisions taken with the human (2026-11-08)

- New repeatable `/kickoff`, not part of the one-time `/start`.
- Roster with self-join (`team.json`), not switching every identity to GitHub logins.
- Claude proposes the split; the lead edits and approves it before anything is written.
- Features are assigned to people; tasks stay with each owner's `/orchestrate`.

## Non-goals

- Designing screens (`/feature` and Claude Design still do that per feature).
- Inviting collaborators or setting branch protection (admin actions; `TEAM.md` §1, §6).
- Task-level owners (several people on one feature).
- Re-splitting automatically when someone leaves (the lead re-runs `/kickoff` or uses
  `npm run features -- owner`).

## Open questions

1. **Demo frontend link** — suggested default: open it in a headless browser, follow
   in-app links up to 20 pages, and record each screen (title, main actions, forms) as
   input; screenshots stay local, not committed. A login-protected demo → ask for a test
   account or a feature list instead.
2. **PRD formats** — suggested default: Markdown, PDF, DOCX and plain text from a path in
   the repo or on disk; a Google Doc / Notion link → ask the lead to export it.
3. **Split heuristic** — suggested default: estimate each feature S/M/L, put shared
   foundations (auth, app shell, API contract) first with one owner, keep related features
   together, balance total size, and at most 2 starting features per person (the
   `activePerOwner` limit).
4. **CLAUDE.md is at 198/200 lines** — suggested default: move the per-command one-liners
   into `.claude/rules/commands.md` and keep only the eight names in CLAUDE.md.
5. **Size** — ~450 reviewable lines, so split in two PRs: (A) roster + `@login` owners +
   `team` CLI; (B) `/kickoff` command + docs.

## Impact

`scripts/harness/team.mjs` (extend) + `lib.mjs` + `features.mjs` / `io.mjs` / `scope.mjs`
(owner resolution) + tests, `team.json` (new), `.github/CODEOWNERS`,
`.claude/commands/kickoff.md` (new), `.claude/commands/orchestrate.md`, `CLAUDE.md`,
`.claude/rules/commands.md`, `TEAM.md`, `README.md`. No app code, no new dependency.
