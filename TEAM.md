# Working as a team

Two (or more) developers, each owning features, each running one `/orchestrate` window.
You approve your own tasks' plans (Gate 1); your teammate reviews and approves your PRs
(Gate 2), and you review theirs. GitHub never lets an author approve their own PR, so once
the branch rules below are on, every merge has had a second pair of eyes.

Check the setup any time: `npm run team:check` (read-only; needs `gh`, and admin access to
read branch protection). `/orchestrate` runs it at clock-in.

## 0. Kickoff (the lead, once per PRD / new teammate)

`/kickoff <PRD path | demo URL | feature list>` drafts the features, takes the team's
GitHub usernames, and proposes who builds what (foundations first, related features
together, balanced). Nothing is written until you approve the features and the split;
then it writes `features.md`, `features.json` (owners as `@login`), `team.json`,
CODEOWNERS and `PROGRESS.md` sections in one PR, and gives you a short message for each
teammate. Run it again for a new PRD version or a new person — existing owners stay.
`npm run team` shows the roster: who joined, and what each owns.

## 1. Access (repo admin, once per teammate)

1. Settings → Collaborators → add the teammate with **write** access.
2. Put their GitHub username on **every** line of `.github/CODEOWNERS` (GitHub uses only
   the last matching line per file, so each line needs both of you):
   `npm run team -- add @login` then `npm run team -- codeowners` (`/kickoff` does both),
   and merge it.
3. Then turn on branch protection (section 6). **Not before** — with code-owner review
   required and only one real owner, nobody can approve that owner's PRs.

## 2. Your machine (each developer)

```bash
git config user.email you@example.com   # the harness uses it as your owner id
gh auth login
nvm install && nvm use                  # Node from .nvmrc
npm ci && npx playwright install chromium
cp .env.example .env
npm run team -- join                    # links your GitHub name to your git email; PR team.json
claude                                  # then: /orchestrate
```

## 3. Who owns what

- `npm run features` shows every feature and its owner (`@login` or a git email). Only
  the owner starts, blocks, verifies, re-scopes or hands over a feature; at most 2 active
  each. An `@login` owner can do that only after `npm run team -- join`.
- Hand a feature over: the current owner runs `npm run features -- owner F0n --set
@login` (someone on `team.json`) and opens a PR.
- Someone left or is away: a **lead** (`leads` in `team.json`; the first member if none
  are named) hands over any unfinished feature with `npm run features -- owner F0n --set
@login --reason "…"`. Then `npm run team -- remove @login` (refuses while they still own
  an unfinished feature) and `npm run team -- codeowners`.
- `npm run progress` and `features check` warn when someone has more than 2 active (two
  branches each started one): block one.
- `PROGRESS.md` has one section per developer, headed by `@login` or their email. Edit
  only yours.
- `team.json` and the ledger's `join` lines decide who `@login` is. The harness can't
  check identity: review a changed `team.json` like a changed CODEOWNERS.

## 4. A normal day

1. `/orchestrate F0n` — it plans your feature into tasks and starts workers.
2. Answer what it brings you: "approve <task>" (Gate 1), or answers to questions.
3. Review your teammate's PRs on GitHub (Gate 2). Their PRs list you as reviewer.
4. Close the window when you're done; `/orchestrate` resumes from the board next time.

## 5. Who approves what

| Gate                      | Who                        | Where                       |
| ------------------------- | -------------------------- | --------------------------- |
| Gate 1 — a task's plan    | the feature's owner        | their `/orchestrate` window |
| Gate 2 — a task's PR      | the other developer        | GitHub review + merge       |
| `large-pr-approved` label | a human, after reading why | GitHub                      |
| Branch rules, access      | the repo admin             | GitHub Settings             |

## 6. Branch protection (repo admin)

What `npm run team:check` expects on the default branch: required checks `approvals`,
`node-22`, `quality`, `size`; 1 approving review; review from Code Owners; stale approvals
dismissed on new pushes; approval of the most recent push; administrators included; no
force pushes, no deletion.

`strict` is off on purpose: with it on, every time `master` moves the author must update
their branch, and that push dismisses the teammate's approval — two developers end up
re-approving in a loop. CI still runs on each PR's merge with `master`. `enforce_admins`
is on: nobody, the admin included, merges without the other's review — no hotfix bypass
while a teammate is away (turn it off only as a deliberate team decision). `team:check`
reads classic branch protection only; a ruleset-protected repo shows as unprotected.

Run this in **your own terminal** (Claude's guard blocks protection changes on purpose),
replacing `OWNER/REPO` and `master` if needed:

```bash
gh api -X PUT repos/OWNER/REPO/branches/master/protection --input - <<'JSON'
{
  "required_status_checks": {
    "strict": false,
    "checks": [
      { "context": "approvals" },
      { "context": "node-22" },
      { "context": "quality" },
      { "context": "size" }
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "require_code_owner_reviews": true,
    "dismiss_stale_reviews": true,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
npm run team:check
```

## 7. When something conflicts

- `features.ledger.jsonl` and `DECISIONS.md` merge by union (`.gitattributes`). If GitHub
  still shows a conflict in them, run `git merge origin/master` locally (it applies the
  union) and push.
- `features.json` conflicts only when two people add a feature at once: keep both entries
  (`features add` gives each a different id, also across pushed branches).
  If both changed the same feature's scope or owner, keep both in the file, then the owner
  re-runs `npm run features -- scope|owner …` so the ledger matches.
- `team.json` / CODEOWNERS conflict (two people added a member): keep both members, then
  `npm run team -- codeowners`. `harness:check` fails while a CODEOWNERS line misses one.
- The same feature started on two branches is fine: the repeated move is ignored.
- `npm run features -- check` rejects ledger lines the CLI wouldn't write (wrong state,
  no evidence, not the owner). Fix the cause; never hand-edit the ledger.
