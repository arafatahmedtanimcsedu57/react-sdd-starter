#!/usr/bin/env bash
# Sourced by the hooks. Claude Code sets $CLAUDE_PROJECT_DIR to the main checkout even when
# a worker agent runs in a git worktree (.claude/worktrees/<agent>/), so a hook that cd's
# there checks the wrong tree: a worker's type errors, scope and tests were all missed
# (see DECISIONS.md, 2026-11-08). Resolve the checkout from where the work happens instead.

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
