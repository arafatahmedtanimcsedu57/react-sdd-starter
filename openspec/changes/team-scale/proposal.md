Risk tier: medium

Feature: none (harness change)

## Why

We simulated a 7-person team (later 11) on a fresh template copy: a bare repo as GitHub,
one clone per developer, a fake `gh`, about 30 PRs, and every merge CI-checked
(`features check`). Script: `scripts/harness/team-sim.test.mjs` (added here). What held
up: six joins at once, kickoff, the scope guard, the owner guard, a join PR stacked under
feature work. What broke:

| #   | Scenario                                                    | What happened                                                                                         |
| --- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| S7  | An owner starts the same feature on two branches            | Both PRs green; merging the second turns **master CI red** for everyone ("active → active")           |
| S6  | An owner starts 3 features on 3 branches (limit 2)          | All merge green; master has 3 active, and nothing says so                                             |
| S5  | A member leaves (or is away) owning a not-started feature   | **Nobody** can reassign it: only the owner may run `features owner`                                   |
| S4  | Two people add a feature at once                            | Both take the next id (F13) → conflict in `features.json` + `features.md`; "keep both" = duplicate id |
| S3b | A new member's join PR isn't merged yet                     | `features start` says "belongs to @kim; you are kim@team.io — hand it over" (wrong advice)            |
| S9  | Two people add a member at once                             | Conflict in `team.json` + every CODEOWNERS line; a bad resolution silently drops a reviewer           |
| S8  | Several people add their `PROGRESS.md` section the same day | Conflict (all append at the end of the file)                                                          |

## What changes

1. **Duplicate moves are harmless (S7).** The ledger replay accepts a move that repeats the
   state the feature is already in (same `to`, by its owner) as a duplicate — it changes
   nothing. Real forks (`active` on one branch, `blocked` on the other) still fail.
2. **Over the limit is visible (S6).** `features check` and `npm run progress` warn —
   not fail — when an owner has more than `limits.activePerOwner` active; failing master
   would block everyone for one person's overlap.
3. **Leads can reassign (S5).** `team.json` gets `"leads": ["<login>"]` (default: the first
   member). A lead may run `npm run features -- owner <id> --set @x --reason "<why>"` on
   any feature that isn't `passing`; the ledger line carries the reason and the ledger
   check accepts it. `npm run team -- remove @login` drops a member who owns no open
   feature (else it lists them to reassign first).
4. **No id collisions (S4).** `features add` without `--id` picks the next id free on
   master **and** every pushed branch (`git fetch` + each remote branch's `features.json`);
   with `--id`, it refuses an id taken on any of them. `/kickoff` stops passing `--id`.
5. **The right advice for a late joiner (S3b).** A move refused because the caller's git
   email isn't linked on this branch says so: "run `npm run team -- join` here, or branch
   from your join branch until it merges". `join`'s next step says the same.
6. **CODEOWNERS stays complete (S9).** `harness:check` fails when, with 2+ members,
   an owned CODEOWNERS line misses a member; the fix it prints is `npm run team --
codeowners`. `TEAM.md` §7: a `team.json` conflict → keep both members, then re-run it.
7. **The simulation stays as a test.** `team-sim.test.mjs` replays S4–S9 in temp repos, so a
   harness change that breaks team work fails `npm run check`.

## Not in this change

- **S8 (`PROGRESS.md` appends).** `/kickoff` already writes every member's section up front;
  the real fix is one file per person (`progress/<login>.md`), which touches clock-in,
  clock-out and CLAUDE.md — its own change.
- **Not simulated:** the Claude sessions themselves (`/orchestrate` workers), GitHub branch
  protection, and code conflicts in shared registry files (`routes.tsx`, `handlers.ts`)
  across many features — likely the biggest real cost for a big team; worth a later look.

## Open questions

1. **Who is a lead** — suggested default: `leads` in `team.json`, defaulting to the first
   member; changed only in a reviewed PR (same trust model as the rest of `team.json`).
2. **Over-limit on master** — suggested default: warn, don't fail (see 2).
3. **Size** — ~250 reviewable lines + the simulation test: one PR.

## Impact

`scripts/harness/{lib,features,roster,instructions,progress}.mjs` + tests, `team.json`
schema (optional `leads`), `.claude/commands/kickoff.md`, `TEAM.md`, `DECISIONS.md`.
No app code, no new dependency.
