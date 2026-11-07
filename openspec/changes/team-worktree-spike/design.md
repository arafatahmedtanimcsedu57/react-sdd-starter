# Design — hooks that check the worker's worktree

No UI.

## Repo root resolution (one helper, all three hooks)

`.claude/hooks/lib.sh`:

```bash
# repo_root <dir>: the git checkout (main or worktree) that <dir> belongs to.
repo_root() {
  git -C "${1:-.}" rev-parse --show-toplevel 2>/dev/null || printf '%s' "${CLAUDE_PROJECT_DIR:-.}"
}
```

| Hook            | Directory passed to `repo_root`                        |
| --------------- | ------------------------------------------------------ |
| `post-edit.sh`  | folder of `tool_input.file_path`                       |
| `stop-check.sh` | `.cwd` from the hook input                             |
| `guard-bash.sh` | `.cwd` from the hook input (branch is read from there) |

Each hook still runs the scripts from the resolved root (`node scripts/harness/…`), so a
worker uses its own branch's copy of the harness.

## SubagentStop

`settings.json` adds a `SubagentStop` entry pointing at `stop-check.sh`. The script already
guards against loops with `stop_hook_active`, and with no changed `src/` files it exits after
`ready` + `scope`.

## `ready.mjs` and `node_modules`

Look for `node_modules` from the root upwards and use the first one found — the same
lookup Node and npx do. A worktree nested in the main checkout then reports the main
install, and a lockfile mismatch is still caught against the worktree's `package-lock.json`.

## Proof

Re-run the probe (a worktree-isolated background agent) after the change and expect:

1. a type-only error in a worker file → `Typecheck failed` feedback in the worker's turn;
2. a worker file outside the active feature's scope → scope error when the worker stops;
3. `git status` in the main checkout stays clean while the worker runs.

Unit-level: `scripts/harness/env.test.mjs` covers the upward `node_modules` lookup.

## Rejected

- **Symlinking `node_modules` into each worktree** — needs a step at worktree creation,
  which Claude Code does, not us; the upward lookup matches what already works.
- **`npm ci` per worktree** — minutes and hundreds of MB per worker.
