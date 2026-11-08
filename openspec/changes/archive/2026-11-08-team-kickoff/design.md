# Design — /kickoff and the team roster

No UI.

## Roster: `team.json` (committed)

```json
{
  "version": 1,
  "members": [
    { "github": "arafatahmedtanimcsedu57", "email": "arafatahmedtanimcsedu57@gmail.com" },
    { "github": "x-dev" }
  ]
}
```

- `email` is filled only by that person's own `npm run team -- join` (their
  `git config user.email` + `gh api user` login) — never guessed by the lead or Claude.
- Validated with Zod (`lib.mjs parseTeam`): unique logins, unique emails, login format.
- Merge-safe enough: one line per member; a conflict is "keep both".
- Every `join` also appends `{ "event": "join", "github": "…" }` (with `by` = the email) to
  `features.ledger.jsonl`. Ledger lines are checked against the links in force when they
  were written (a re-join with a new email stays valid), and a `team.json` email with no
  matching join line is drift — a hand edit can't silently take over an unjoined member's
  features. Still not authentication: PR review of `team.json` + ledger is the gate.
- An `@login` owner must be on the roster (`features add` / `owner --set` refuse others).

## Identity

`whoami()` = `{ email: git config user.email, github: roster login for that email }`.
`isOwner(feature, me)` = `owner === me.email || owner === '@' + me.github`. Used by
`transition`, `setDefinition`, `scopeForBranch`, `findLedgerAnomalies` (ledger `by` stays
the email; an owner `@login` matches any `by` email the roster maps to it).

`PROGRESS.md` sections: `ownSection` accepts `## @login` or `## <email>`.

## `npm run team`

| Command                      | Who        | Does                                                                                                 |
| ---------------------------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| `npm run team`               | anyone     | members, joined or not, features owned (active / total)                                              |
| `npm run team -- add @login` | lead       | adds a member (no email)                                                                             |
| `npm run team -- join`       | the member | links their login ↔ email; runs `ready` + `team:check`; prints their features and `/orchestrate F0n` |
| `npm run team -- codeowners` | lead       | rewrites `.github/CODEOWNERS`: every line → every member                                             |

## `/kickoff` flow

0. Clock in; branch `chore/kickoff-<yyyy-mm-dd>`.
1. **Read the input** (`$ARGUMENTS`, or ask): PRD file (Markdown / PDF / DOCX / text), demo
   URL (headless browser, ≤20 in-app pages: title, main actions, forms, states seen), or a
   feature list. Summarise the product in 5 lines + a list of open questions.
2. **Draft features** in `features.md`'s template (who/why, behaviour, states, edge cases,
   open questions), next free ids. Unknowns go under Open questions — never invented.
   The lead edits/approves the list. (`features.md` is human-owned.)
3. **Team**: the lead gives GitHub names → `npm run team -- add` each.
4. **Proposed split** (a table): feature, size S/M/L, depends on, owner, start order.
   Rules: foundations (app shell, auth, API contract) first, one owner; related features
   together; balanced total size; ≤2 starting features per person. The lead edits/approves.
5. **Write** (only now): `features.md`; `npm run features -- add --id … --owner @login
--verify "npx playwright test e2e/<slug>.spec.ts" --scope src/features/<slug>,…`;
   `npm run team -- codeowners`; one empty `## @login` section per member in
   `PROGRESS.md`; the plan (table) under PROGRESS → Team-wide. One PR, reviewer: another
   member.
6. **Tell each teammate**: pull, `npm run team -- join`, `/orchestrate <their feature>`.

Re-run: existing features and members are kept; only new input is added, and the split
proposes owners for unassigned features only.

## Split into two PRs

- **A — roster + identity** (~250 lines): `team.json`, `parseTeam`, `whoami` / `isOwner`,
  `@login` owners through features/scope/ledger/progress, `npm run team` commands, tests.
- **B — `/kickoff`** (~200 lines): the command, `/orchestrate` and `TEAM.md` updates,
  CLAUDE.md (8 commands) + `.claude/rules/commands.md`.

## Rejected

- **GitHub login as the only identity** (human choice) — every command would need `gh`,
  and the ledger would need migrating.
- **Lead fills in teammates' emails** — a wrong email silently gives someone else the
  feature; only the person can say which email they commit with.
- **Kickoff assigns tasks** (human choice) — task-level owners don't exist; `/orchestrate`
  already plans tasks per feature.
- **Folding into `/start`** (human choice) — `/start` runs once; PRD versions and new
  teammates arrive later.
