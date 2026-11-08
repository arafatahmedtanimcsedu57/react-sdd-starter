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

`teamSchema`: optional `leads: string[]` (logins on the roster). `isLead(team, me)` =
`me.github` in `leads ?? [members[0].github]`.

- `features owner <id> --set X`: allowed for the owner, or for a lead with `--reason`
  (required then) on a non-passing feature. Ledger line `{ event: 'owner', owner, reason, by }`.
- `findLedgerAnomalies(ledger, team)`: an owner change with a `reason` by a lead is accepted.
  Leads come from the current `team.json` (reviewed in PRs like CODEOWNERS); the join map
  still resolves `by` → login.
- `team -- remove @x`: refuses while x owns a not-passing feature (lists them); else
  removes x from `members` and `leads`. Ledger history keeps x's lines valid (joins stay).

## 4. Next free id

`takenIds()` = ids in local `features.json` ∪ `origin/master` ∪ every `refs/remotes/origin/*`
(`git show <ref>:features.json`, after `git fetch --quiet`; offline → local + cached refs, with
a note). `add` without `--id` → `F` + (max + 1), zero-padded to 2. `--id` taken elsewhere →
fail naming the branch. Still a race between two `add`s in the same minute; a later conflict
in `features.json` now means "re-run `add` without `--id`".

## 5. Late-joiner message

In `transition` / `setDefinition` refusals: if the owner is `@login`, the caller has no
login on this branch, and the roster has that login **unjoined** → "you aren't joined on
this branch: `npm run team -- join` here, or branch from your join branch until it merges".

## 6. CODEOWNERS completeness

`codeownersMissing(text, logins)` → owned lines missing a member. `instructions.mjs`
(`harness:check`) fails on it when `team.json` has 2+ members.

## 7. Simulation test

`team-sim.test.mjs`: bare origin + clones in a temp dir, fake `gh` on `PATH`, the harness
scripts of this checkout run in each clone (`node_modules` symlinked). Asserts the fixed
behaviour for S4, S5, S6, S7, S9 and S3b. Excluded from the PR size count (test file).

## Rejected

- **Fail master on over-limit** — one person's overlap would block every PR.
- **Lead = whoever ran `/kickoff`** — not recorded anywhere a script can read.
- **Central id counter file** — it would conflict exactly like `features.json`.
- **Union-merge `PROGRESS.md`** — two edits to the same line would both survive, silently.
