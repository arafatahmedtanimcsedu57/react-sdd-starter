# Design — team-scale

No UI.

## 1. Duplicate moves (`findLedgerAnomalies`)

Before the "moves from X but the feature was Y" check: if `e.to === state[e.id]`,
`ALLOWED[e.from]` includes `e.to`, and the line is by the owner (or unchecked) → skip it
(a duplicate from a parallel branch). `replay` already ends in the same state. Applies to
`active` and `passing` (verify run on two branches); `passing` still needs evidence.

## 2. Over the limit

`overLimit(features, limits)` → `[{ owner, ids }]` where active count > limit. Printed as
`⚠` by `features check` (exit 0) and `npm run progress`, with "block one:
`npm run features -- block <id> --reason …`".

## 3. Leads

Recorded in the ledger and replayed in order, like joins (changed after review: reading
them from today's `team.json` made a departed lead's old hand-overs fail master, and made
a new lead's old lines valid).

- The first `join` line founds the team: its login is the first lead.
- `npm run team -- lead @x [--remove]` (by a lead) appends `{ event: 'lead', github, remove? }`;
  never removes the last lead. `team -- remove @x` drops x's lead role the same way.
- `findLedgerAnomalies` keeps a lead set as it replays: a `lead` line by a non-lead, or one
  that empties the set, is flagged; an `owner` line with a `reason` by a lead **at that
  line** is accepted; an `owner` line on a `passing` feature is flagged.
- `team.json` `leads` is a readable copy written by `npm run team`; when present it must
  match the ledger (drift). Absent → nothing to check (old rosters keep working).
- `features owner <id> --set X`: the owner, or a lead with `--reason`, on a non-passing feature.
- `team -- remove @x`: a lead only; refuses while x owns a not-passing feature.

## 4. Next free id

`idsElsewhere()` = ids in every `refs/remotes/*` and `refs/heads/*` `features.json` (after
`git fetch`, 10 s timeout, no prompts; offline → the refs already here, with a warning). `add` without `--id` → `F` + (max + 1), zero-padded to 2. `--id` taken elsewhere →
fail naming the branch. Still a race between two `add`s in the same minute; a later conflict
in `features.json` now means "re-run `add` without `--id`".

## 5. Late-joiner message

In `transition` / `setDefinition` refusals: if the owner is `@login`, the caller has no
login on this branch, and the roster has that login **unjoined** → "you aren't joined on
this branch: `npm run team -- join` here, or branch from your join branch until it merges".

## 6. CODEOWNERS completeness

`codeownersMissing(text, logins)` → owned lines missing a member (lines owned by a team
`@org/x` or an email are the team's choice: skipped). Extra, departed logins aren't flagged. `instructions.mjs`
(`harness:check`) fails on it when `team.json` has 2+ members.

## 7. Simulation test

`team-sim.test.mjs`: bare origin + clones in a temp dir, fake `gh` on `PATH`, the harness
scripts of this checkout run in each clone (`node_modules` symlinked). Asserts the fixed
behaviour for S4, S5, S6, S7, S9 and S3b. Excluded from the PR size count (test file).

## Rejected

- **Fail master on over-limit** — one person's overlap would block every PR.
- **Lead = whoever ran `/kickoff`** — not recorded anywhere a script can read.
- **Leads read from today's `team.json`** — see 3 (found in review).
- **Central id counter file** — it would conflict exactly like `features.json`.
- **Union-merge `PROGRESS.md`** — two edits to the same line would both survive, silently.
