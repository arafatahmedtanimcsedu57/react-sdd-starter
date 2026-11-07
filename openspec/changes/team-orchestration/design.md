# Design — team orchestration

No UI artboards: this is a harness change.

## Shape

```
              central repo (master, PRs)
               ▲                      ▲
   you ── ORCHESTRATOR (you)      ORCHESTRATOR (X) ── X
            │ board, queue           │
     ┌──────┼──────┐          ┌──────┼──────┐
   worker worker worker     worker worker worker
   (task)  (task)  (task)    (task)  (task)  (task)
   worktree + branch + one OpenSpec change + one PR each
```

| Level        | Lives in                                    | Shared via git? |
| ------------ | ------------------------------------------- | --------------- |
| Feature      | `features.json` (+ `owner`), `features.md`  | yes             |
| Task         | `openspec/changes/<task>/` (one change)     | yes             |
| Worker       | background agent, `../<repo>-wt/<task>/`    | no              |
| Board, queue | `.claude/orchestra/board.json` (gitignored) | no              |

Rule of thumb: **anything another person or a later session must know goes in git;
anything only this orchestrator needs right now stays local.**

## Names

The board never shows IDs alone. Every row is `<feature title> › <task title>`, e.g.
`Login/Registration › Password reset email`. The task's change name is the kebab form
(`password-reset-email`), its branch `feat/<feature-slug>/<task>`.

## Board

`npm run board` prints it from `board.json`, the worktrees, `openspec` and `gh pr list`:

```
Login/Registration (you)                          workers 3/4
  ● Login form ............. coding     3/7 tasks   2m ago
  ? Register API contract .. NEEDS YOU  Gate 1: tasks.md ready (≈160 lines)
  ◷ Password reset email ... queued     waits for: Register API contract
  ✓ Session refresh ........ PR #31 open, review: X
Needs you (1)
  1. Register API contract — approve tasks.md? Summary: 3 endpoints, Zod schemas,
     MSW mocks. Recommended: approve.          → reply "approve 1" or "change 1: …"
```

States: `planned → drafting → needs-you (gate 1) → coding → needs-you (question) →
checking → PR open → merged → finished`, plus `queued` and `blocked`.

## Task lifecycle

1. **Plan** — `/orchestrate <feature>`: the orchestrator reads `features.md`, proposes a task
   list (title, one-line goal, folders, depends-on, estimate). The owner edits/accepts it.
   Accepted tasks get rows on the board.
2. **Start** — for each runnable task (deps met, no folder overlap with a running task,
   under the worker cap) the orchestrator creates the worktree + branch and starts a
   `task-worker` background agent with a **self-contained brief** (below).
3. **Draft** — the worker writes `proposal.md / design.md / tasks.md` for its change, ends
   `tasks.md` with `approved: <pending>`, and reports `needs-you: gate1`.
4. **Gate 1** — the board shows a summary. Only when the owner says "approve" does the
   orchestrator write `approved: <owner>, <date>` in that worktree and resume the worker.
5. **Build** — the worker implements, runs `npm run check`, its proof command and
   `react-reviewer`. Any question it can't settle → it stops and reports
   `needs-you: <question> + recommended answer`.
6. **PR** — the worker opens the PR (≤400 lines) with the other developer as reviewer and
   reports `pr-open`. It ends. The worktree stays until merge.
7. **Finish** — once merged, the orchestrator runs `/finish <task>` and removes the worktree.
   When every task of a feature is merged it runs `npm run features -- verify <id>`.

## The worker brief (why it matters)

A worker starts with no memory. Its brief is the only context it gets, so it must stand on
its own: feature title + owner, task title + goal, its folders (scope), `depends on`
changes and what they provide, links to `features.md` section and design artboards, the
rule "stop and report instead of guessing", and the exact report format. The orchestrator
never relies on what it "remembers" about a worker — it rebuilds the board from files.

## Worker → orchestrator messages

Last line of every worker stop, so the orchestrator can parse it:

```
STATUS: <drafting|needs-you|coding|checking|pr-open|blocked|done> | <one line>
```

The orchestrator writes each status to `board.json` before showing it.

## Merge-safe shared state

| File                     | Today                       | Change                                                    |
| ------------------------ | --------------------------- | --------------------------------------------------------- |
| `features.ledger.jsonl`  | append, conflicts           | `.gitattributes merge=union`; lines carry `feature` id    |
| `features.json`          | stores state + definitions  | definitions + `owner` only; state = ledger replay         |
| `PROGRESS.md` auto block | one branch, one "next step" | per-owner sections; no branch line                        |
| `DECISIONS.md`           | newest first (top inserts)  | new entries appended at the end, `merge=union`            |
| WIP=1                    | one active feature per repo | one active **task per worktree**, cap per owner           |
| scope check              | active feature's folders    | the branch's change's folders (from `proposal.md` Scope:) |

Replay is per feature, so interleaved ledger lines from two owners replay the same.

## Gates

- Gate 1: per task, by the owner, through the orchestrator.
- Gate 2: CI fails unless the PR has an approving review from someone other than its author;
  CODEOWNERS = both developers.

## Rejected

- **One file per feature/decision** (`features/F03.json`, `decisions/0007.md`) — also
  conflict-free, but adds top-level folders and rewrites every script; union merge gets the
  same result with a few lines.
- **Workers in terminals the developer opens** — human chose automatic start.
- **Gate 1 once per feature** — human chose per task.
- **Orchestrators messaging each other** — no reliable channel across machines; git already
  is one.
