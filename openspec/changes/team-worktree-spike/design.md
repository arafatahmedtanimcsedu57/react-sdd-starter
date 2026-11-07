# Design — hooks that check the worker's worktree

No UI.

## Repo root resolution (one helper, all three hooks)

`.claude/hooks/lib.sh`:

```bash
# repo_root <dir>: the checkout of this project (main or worktree) that <dir> belongs to.
# Falls back to $CLAUDE_PROJECT_DIR when <dir> is empty, not in git, or in another repo.
repo_root() {
  local top
  if [ -n "${1:-}" ] && top=$(git -C "$1" rev-parse --show-toplevel 2>/dev/null) &&
    [ -f "$top/scripts/harness/ready.mjs" ]; then
    printf '%s\n' "$top"
  else
    printf '%s\n' "${CLAUDE_PROJECT_DIR:-.}"
  fi
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
guards against loops with `stop_hook_active`. On `SubagentStop` it exits early unless the
checkout is a linked worktree, so read-only helpers in the main checkout (`react-reviewer`,
`codebase-explorer`) don't run tests they can't act on.

## `ready.mjs` and `node_modules`

`findModulesRoot` (`env.mjs`) walks up from the checkout to the main checkout (parent of
the shared `.git`) and returns the nearest folder with a real npm install
(`node_modules/.package-lock.json`), the same packages Node resolves. A `node_modules`
holding only tool caches (eslint/prettier create `node_modules/.cache`) is skipped; with no
real install anywhere, the nearest `node_modules` is reported as "not installed by npm". A
lockfile mismatch is still checked against the worktree's own `package-lock.json`.

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
