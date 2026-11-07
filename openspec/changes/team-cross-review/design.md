# Design — cross review that is actually enforced

No UI.

## `npm run team:check`

`scripts/harness/team.mjs` gathers facts with read-only `gh api` calls; `lib.mjs`
`checkTeamSetup(facts)` turns them into problems (pure, unit-tested).

| Fact              | Source                                                      |
| ----------------- | ----------------------------------------------------------- |
| default branch    | `gh repo view --json defaultBranchRef`                      |
| protection        | `gh api repos/{o}/{r}/branches/{b}/protection` (404 = none) |
| collaborators     | `gh api repos/{o}/{r}/collaborators --jq '.[].login'`       |
| CODEOWNERS owners | `.github/CODEOWNERS` (local file)                           |

| Rule                                                         | Why                                            |
| ------------------------------------------------------------ | ---------------------------------------------- |
| branch is protected                                          | otherwise nothing below applies                |
| required status checks include `CI` jobs and `PR size`       | the gates CLAUDE.md calls "definition of done" |
| `required_approving_review_count ≥ 1`                        | Gate 2 exists                                  |
| `require_code_owner_reviews`                                 | the reviewer is a teammate who owns the code   |
| `dismiss_stale_reviews`                                      | a push after approval needs a new look         |
| `require_last_push_approval`                                 | the last pusher can't be the only approver     |
| `enforce_admins`                                             | the admin (you) can't merge around it          |
| force pushes and deletion off                                | history can't be rewritten on `master`         |
| CODEOWNERS has ≥ 2 owners, no placeholder, all collaborators | someone other than the author can approve      |

Output: `✓` per rule, or `✗ <rule>` + `FIX (repo admin): <what to set>`. Exit 1 on any
miss. Without `gh` or with no access to protection (403): say so and exit 1 — never a
silent pass.

The required check names come from the workflows: CI's job names and `PR size`.

## `/orchestrate` clock-in

Adds `npm run team:check` after `npm run ready`. On failure: show the misses to the owner
once per session, keep going (local work is fine), but say plainly that Gate 2 is not
enforced until they're fixed.

## `TEAM.md`

1. Access: admin adds X as collaborator (write).
2. Each developer: `git config user.email`, `gh auth login`, `nvm use`, `npm ci`,
   `npx playwright install chromium`, start Claude Code in the repo.
3. Ownership: `npm run features`; hand over with `npm run features -- owner F0n --set …`
   (by the current owner).
4. Daily: `/orchestrate F0n` — approve tasks there; review the other's PRs on GitHub.
5. Who approves what: Gate 1 = the feature's owner (in their orchestrator); Gate 2 = the
   other developer (GitHub review); `large-pr-approved` = a human, after reading why.
6. Conflicts: ledger / `DECISIONS.md` merge by union; if GitHub shows a conflict there,
   `git merge origin/master` locally and push.
7. Protection: the table above, plus one admin command (`gh api -X PUT …/protection` with
   the JSON body), and "run `npm run team:check` after".

## Tests

- `checkTeamSetup`: unprotected branch; each rule missing on its own; a complete setup
  passes; CODEOWNERS with one owner / a placeholder / a non-collaborator.
- `parseCodeowners`: comments, multiple owners per line, teams (`@org/team`).

## Rejected

- **CI job requiring a non-author approval** — GitHub already forbids self-approval; with
  required reviews on, it's enforced before merge. A job would duplicate it and can't stop
  a merge anyway.
- **Applying protection from the harness** — a repo-admin decision with outward effect;
  `guard-bash.sh` blocks protection writes on purpose.
- **`team:check` inside `npm run check`** — CI tokens can't read protection; it would fail
  every PR or be skipped silently.
