# Working as a team

Two (or more) developers, each owning features, each running one `/orchestrate` window.
You approve your own tasks' plans (Gate 1); your teammate reviews and approves your PRs
(Gate 2), and you review theirs. GitHub never lets an author approve their own PR, so once
the branch rules below are on, every merge has had a second pair of eyes.

Check the setup any time: `npm run team:check` (read-only; needs `gh`, and admin access to
read branch protection). `/orchestrate` runs it at clock-in.

## 1. Access (repo admin, once per teammate)

1. Settings → Collaborators → add the teammate with **write** access.
2. Put their GitHub username in `.github/CODEOWNERS`, replacing
   `@teammate-github-username`, in a PR the other developer reviews.
3. Then turn on branch protection (section 6). **Not before** — with code-owner review
   required and only one real owner, nobody can approve that owner's PRs.

## 2. Your machine (each developer)

```bash
git config user.email you@example.com   # the harness uses it as your owner id
gh auth login
nvm install && nvm use                  # Node from .nvmrc
npm ci && npx playwright install chromium
cp .env.example .env
claude                                  # then: /orchestrate
```

## 3. Who owns what

- `npm run features` shows every feature and its owner (a git email). Only the owner
  starts, blocks, verifies, re-scopes or hands over a feature; at most 2 active each.
- Hand a feature over: the current owner runs
  `npm run features -- owner F0n --set them@example.com` and opens a PR.
- `PROGRESS.md` has one section per developer, headed by their email. Edit only yours.

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

Run this in **your own terminal** (Claude's guard blocks protection changes on purpose),
replacing `OWNER/REPO` and `master` if needed:

```bash
gh api -X PUT repos/OWNER/REPO/branches/master/protection --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
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
- `features.json` conflicts only when two people add a feature at once: keep both entries.
  If both changed the same feature's scope or owner, keep both in the file, then the owner
  re-runs `npm run features -- scope|owner …` so the ledger matches.
- `npm run features -- check` rejects ledger lines the CLI wouldn't write (wrong state,
  no evidence, not the owner). Fix the cause; never hand-edit the ledger.
