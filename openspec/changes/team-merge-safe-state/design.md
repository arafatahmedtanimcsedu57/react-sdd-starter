# Design — merge-safe harness state

No UI.

## Files after the change

`features.json` (v2) — definitions only, rarely changes:

```json
{
  "version": 2,
  "limits": { "activePerOwner": 2 },
  "features": [
    {
      "id": "F03",
      "title": "Login and registration",
      "owner": "you@example.com",
      "verify": "npx vitest run src/features/auth && npx playwright test e2e/auth.spec.ts",
      "scope": ["src/features/auth", "src/routes"]
    }
  ]
}
```

`features.ledger.jsonl` — the only place state lives; one line per event, `merge=union`:

```json
{"at":"…","commit":"abc123","by":"you@example.com","id":"F03","from":"not_started","to":"active"}
{"at":"…","commit":"abc124","by":"you@example.com","id":"F03","event":"verify_failed"}
{"at":"…","commit":"abc125","by":"you@example.com","id":"F03","from":"active","to":"passing","evidence":{"commit":"abc125","at":"…"}}
```

Replay is per feature, and one feature's lines all come from its owner's branches, so
union-merged lines from two owners replay to the same states in any interleaving.
`attempts` = `verify_failed` lines since the feature last became active.

## Replay (`lib.mjs`)

`featureStates(list, ledger)` → `[{ ...definition, state, attempts, evidence?,
blockedReason? }]`. Every script reads features through it, so the rest of the code keeps
working on the same shape as today.

The drift check changes meaning: definitions in `features.json` must match the ledger's
`add` / `scope` / `owner` lines (a hand-widened scope is still caught); state can't drift
because it isn't stored twice.

## Rules

| Command  | Rule                                                                                         |
| -------- | -------------------------------------------------------------------------------------------- |
| `add`    | `--owner` defaults to `git config user.email`; must be an email                              |
| `start`  | caller is the owner; owner's active count < `activePerOwner`                                 |
| `block`  | caller is the owner; needs `--reason`                                                        |
| `verify` | caller is the owner; `npm run check` + proof → `passing`, else a `verify_failed` line        |
| `scope`  | unchanged (ask a human); recorded with `by`                                                  |
| `owner`  | `npm run features -- owner F03 --set x@example.com` (hand a feature over; ask a human first) |

The caller is `git config user.email`. Missing → the command fails with
`FIX: git config user.email you@example.com`.

## Scope on a branch (`scope.mjs`)

1. The open changes this branch touched (`openspec/changes/<name>/` in `changedFiles()`);
   each one's `proposal.md` `Feature: F0n` line names its feature.
2. None, or "Feature: none" (harness work) → the caller's own active features.
3. Still none → nothing to check (as today).

Allowed files = union of those features' scopes + `ALWAYS_IN_SCOPE`.

`openspec/config.yaml` already requires the `Feature:` line; its wording gains "use `none`
for harness or docs changes".

## `PROGRESS.md`

`npm run progress` prints, no longer writes:

```
Features — 2 passing · 2 active · 0 blocked · 3 not started
  arafat…@gmail.com   F03 Login and registration (active)
  x@example.com       F04 Dashboard (active), F05 Profile (not started)
Open OpenSpec changes — login-form 3/7 approved; dashboard-layout 0/5 pending
```

The file keeps hand-written notes, one `## <owner>` section each with Current work /
Known issues / Next step. Two owners edit different sections, so git merges them.
`harness:check` fails if the old generated markers come back.

## Migration (in this PR)

- `features.json` → v2: drop `state` / `attempts` / `evidence`, add `owner`, add `limits`.
- Ledger: one `{"event":"owner", "owner":"arafat…"}` line per existing feature, so its
  owner is recorded like any other definition.
- `.gitattributes`: `features.ledger.jsonl merge=union`, `DECISIONS.md merge=union`.
- `PROGRESS.md`: today's notes move under `## arafatahmedtanimcsedu57@gmail.com`.

## Tests (`lib.test.mjs`)

- Two branches' ledgers concatenated in either order replay to the same states.
- `start` refuses a non-owner, and an owner already at `activePerOwner`.
- `attempts` counts `verify_failed` only since the last start.
- Drift: a scope widened by hand in `features.json` is still caught.
- Scope: a branch touching change `login-form` (Feature: F03) uses F03's scope even when
  F04 is also active; "Feature: none" falls back to the caller's active features.
- Progress rendering groups by owner.
- A real `git merge` of two branches that each append ledger lines and each insert a
  `DECISIONS.md` entry finishes without conflicts (temp repo with this `.gitattributes`).

## Rejected

- **One file per feature / per decision** — conflict-free too, but new top-level folders and
  every script rewritten; union merge gets there with one line in `.gitattributes`.
- **Custom merge driver for `PROGRESS.md`** — every clone must run `git config` for it; a
  missing driver silently falls back to a normal (conflicting) merge.
- **Keep global WIP=1** — two developers can't both work.
- **No WIP limit at all** — one person opening every feature at once is the old
  context-overload problem; a small cap keeps it honest.
