# Design — orchestrator, workers, board

No UI (terminal only).

## Roles

| Who           | Is                                              | Writes                                                 |
| ------------- | ----------------------------------------------- | ------------------------------------------------------ |
| Owner (human) | you / X                                         | answers in the orchestrator only                       |
| Orchestrator  | the owner's main Claude session, `/orchestrate` | the board; `approved:` lines; the feature's closing PR |
| Worker        | `task-worker` background agent, own worktree    | one OpenSpec change + its code; one PR                 |

The orchestrator never writes app code. A worker never writes `approved:`, never edits the
board, never touches another task's files.

## Board (`.claude/orchestra/board.json`, gitignored)

```json
{
  "tasks": [
    {
      "id": "login-form",
      "title": "Login form",
      "feature": "F03",
      "folders": ["src/features/auth/LoginForm", "src/routes"],
      "dependsOn": ["auth-contract"],
      "first": false,
      "status": "needs-you",
      "need": "gate1",
      "note": "tasks.md ready — 6 tasks, ≈180 lines",
      "worker": "<agent id>",
      "worktree": ".claude/worktrees/agent-…",
      "branch": "feat/f03/login-form",
      "pr": null,
      "updatedAt": "…"
    }
  ]
}
```

Statuses: `planned → drafting → needs-you(gate1) → coding ⇄ needs-you(question) → checking
→ ready → pr-open → merged → finished`, plus `queued` and `blocked`. `ready` = built and
checked, waiting for the orchestrator's review + PR; `ready` and `pr-open` still hold their
folders (no new task may touch them) but no longer use a worker slot.

`npm run board` prints (PR state via `gh pr view` when `gh` is available):

```
Login/Registration (F03)                                   workers 2/4
  ● Auth contract ......... pr-open    PR #34, review: X
  ? Login form ............ NEEDS YOU  Gate 1 — tasks.md ready (6 tasks, ≈180 lines)
  ◷ Password reset ........ queued     waits for: Auth contract
Needs you
  1. Login form — approve tasks.md?   → "approve login-form" / "change login-form: …"
```

`npm run board -- add <id> --title … --feature F03 --folders a,b [--depends x,y] [--first]`,
`npm run board -- set <id> --status … [--need …] [--note …] [--worker …] [--worktree …]
[--branch …] [--pr …]`, `npm run board -- next` (ids that may start now).

## Scheduling (`lib.mjs` → `runnableTasks`)

A `planned` / `queued` task may start when:

1. every `dependsOn` task is `merged` or `finished` — except a dependency that only
   provides a contract, which counts once its PR is open (the dependant builds on its
   schema + MSW mock from the brief);
2. none of its `folders` overlaps a folder of a running task (`drafting … checking`);
3. running workers < `maxWorkers` (`.claude/orchestra.json`, default 4).

## Flow

1. **Plan** — `/orchestrate F03` (or a feature idea): read `features.md`, `architecture.md`,
   design links; propose tasks (title, goal, folders, dependsOn, size). The **first** task
   is "contract + kickoff" (Zod schema, MSW mock, and the feature's `add`/`start` ledger
   lines). Owner edits/accepts → `board -- add` each.
2. **Start** — for each id from `board -- next`: Agent tool, `subagent_type: task-worker`,
   `isolation: worktree`, background, with the **brief** below. `board -- set <id>
--status drafting --worker <id>`.
3. **Draft** — worker: `git switch -c feat/<feature>/<task>`; writes
   `openspec/changes/<task>/{proposal,design,tasks}.md` (`Feature: F03`, `approved:
<pending>`); commits; stops with `STATUS: needs-you | gate1 | <summary>`.
4. **Gate 1** — orchestrator shows the summary. Only on the owner's "approve <task>": it
   writes `approved: <owner>, <date>` into that worktree's `tasks.md`, commits there, and
   resumes the worker (SendMessage). "change <task>: …" is relayed instead.
5. **Build** — worker implements per `tasks.md`; on any decision the spec doesn't settle:
   commit, `STATUS: needs-you | question | <question> — recommended: <answer>`.
6. **Check** — worker: `npm run check` + its proof part green, commit,
   `STATUS: ready | - | …`. **Orchestrator** (in the owner's window, where permission
   prompts appear): `react-reviewer` on the worktree (FAIL → back to the worker), push,
   `gh pr create` (reviewer: the other developer) → `pr-open`. A subagent can't start
   another subagent, and a background one can't answer permission prompts — so review,
   push and PR stay with the orchestrator.
7. **Merge** — the human merges. Orchestrator marks `merged`, runs `/finish <task>`, removes
   the worktree. When all tasks of a feature are merged: one small **closing PR** with
   `npm run features -- verify F03`.

## The brief (all a worker knows)

Feature id/title/owner; task id/title/goal; folders; dependencies and exactly what they
provide (schema file, mock handlers, PR link); `features.md` section; design artboards;
whether it is the **first** task (only then: `npm run features -- add/start`); and the
rules: stay in folders, never write `approved:`, never edit the board or ledger (unless
first), stop and ask instead of guessing, commit before every stop, last line `STATUS:`.

## STATUS line

```
STATUS: <drafting|needs-you|coding|checking|pr-open|blocked|done> | <need or -> | <one line>
```

`parseStatus` (lib) turns it into `{ status, need, note }`; a stop without one is shown as
`blocked | no STATUS line — ask the worker`.

## Resume

Worktrees and branches outlive the window. `/orchestrate` with a board: for each task in a
running status whose worker is gone, remove its stale worktree (its work is committed on
the branch), start a new worker with the same brief plus "continue on branch
`feat/…`: `git switch` it first".

## guard-bash: bare push to the default branch

For a bare `git push` / `git push origin HEAD`, also resolve `git rev-parse --abbrev-ref
@{push}`; if it is `<remote>/main|master`, block. Explicit-target checks are unchanged.

## Rejected

- **Workers in folders the orchestrator creates** (`git worktree add` + a plain agent) — the
  agent's `cwd` stays the main checkout, so `SubagentStop` skips it and no scope or test
  check runs (slice 1).
- **Workers editing the board** — parallel writers to one JSON file; the orchestrator is the
  single writer and rebuilds it from STATUS lines.
- **Every task runs `features start`** — two branches moving one feature = forked history.
