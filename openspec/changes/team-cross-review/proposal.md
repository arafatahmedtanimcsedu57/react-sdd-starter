Risk tier: high

Feature: none (harness change)

depends on: team-orchestrator (merged, PR #32)

## Why

Slice 4 of `team-orchestration`: Gate 2 must be a review by the **other** developer.
Checking GitHub on 2026-11-08 found:

- **`master` has no branch protection** (`GET …/branches/master/protection` → 404) and no
  rulesets. Any PR can be merged without a review, and a direct push to `master` is only
  stopped by the local `guard-bash.sh` — which earlier PRs called "branch protection is the
  backstop". That backstop does not exist yet.
- The repo has one collaborator; X is not on it, and `.github/CODEOWNERS` names one person.
- GitHub never lets a PR's author approve it. So "approver ≠ author" needs no custom CI —
  it needs protection that **requires** an approving review (from a code owner, on the
  latest push).

## What changes

1. **`npm run team:check`** — read-only (`gh api`): is the default branch protected the
   way the harness assumes? Required checks `CI` + `PR size`, 1 approving review, code-owner
   review, approvals dismissed on new pushes, approval of the last push, admins included,
   no force-push or deletion; CODEOWNERS names at least two people, each a collaborator.
   Each miss prints a `FIX (repo admin):` line. `/orchestrate` runs it at clock-in and
   warns; it is not part of `npm run check` (CI has no admin token).
2. **`TEAM.md`** — onboarding for a second developer: access, `git config user.email`,
   `gh auth login`, Node, first `/orchestrate`, who approves what, handing a feature over,
   the union-merge fallback, and the exact protection settings (with the one `gh api`
   command an admin can run instead of clicking).
3. **`.github/CODEOWNERS`** — both developers own everything; harness/CI paths too.
4. **(optional)** `.github/workflows/pr-size.yml` — also exclude `**/*.test.mjs`, which
   CLAUDE.md already says don't count.

## Non-goals

- Applying branch protection from here — it's a repo-admin action; `guard-bash.sh` blocks
  protection writes by design. The human runs it (one command in `TEAM.md`).
- A CI job re-checking reviews — GitHub enforces it once protection is on.

## Open questions

1. **X's GitHub username and git email** — needed for CODEOWNERS and for handing features
   to X. Suggested default: CODEOWNERS gets a placeholder `@X-github-username` line with a
   `TODO`, and `team:check` fails until it's real.
2. **Include the `*.test.mjs` size-check fix?** Suggested default: yes — it's one line and
   makes the 400-line limit mean what CLAUDE.md says; every harness PR so far needed
   `large-pr-approved` partly because of it.
3. **"Approval of the most recent push"** means after a reviewer approves, any new push
   needs a fresh approval. Suggested default: on — otherwise a commit added after review
   ships unreviewed.

## Impact

`scripts/harness/team.mjs` (new) + `lib.mjs` (pure checks) + tests, `package.json` (one
script), `TEAM.md` (new), `.github/CODEOWNERS`, optionally `.github/workflows/pr-size.yml`,
`.claude/commands/orchestrate.md` (clock-in line), `README.md`, `PIPELINE.md`,
`DECISIONS.md`. No app code, no new dependency.
