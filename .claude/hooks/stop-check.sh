#!/usr/bin/env bash
# Stop: before Claude ends a turn, check the changes stay inside the active feature's scope,
# then run the tests related to changed source files and react-doctor on them. Failures go
# back to Claude (exit 2) once; if the retry still fails, the turn ends and the human sees
# the red result.
set -u
input=$(cat)
[ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0
. "$(dirname "$0")/lib.sh"
# shellcheck source=trace.sh
. "$(dirname "$0")/trace.sh" # before the cd: $0 may be relative
cd "$(repo_root "$(printf '%s' "$input" | jq -r '.cwd // empty')")" || exit 0

# SubagentStop also fires for read-only helpers (react-reviewer, codebase-explorer) that run
# in the main checkout; they can't fix code. Only workers in a linked worktree get checked.
if [ "$(printf '%s' "$input" | jq -r '.hook_event_name // empty')" = SubagentStop ] &&
  [ "$(git rev-parse --absolute-git-dir 2>/dev/null)" = \
    "$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" ]; then
  exit 0
fi
TRACE_SESSION=$(printf '%s' "$input" | jq -r '.session_id // empty')

# Wrong Node or stale node_modules makes every later check fail with a misleading stack
# trace. Say so plainly instead; ready.mjs needs nothing installed to run.
if ! run stop-hook ready node scripts/harness/ready.mjs; then
  printf '%s\n' "$out" >&2
  exit 2
fi

# WIP=1 covers files too: everything changed on this branch must sit inside the active
# feature's scope (features.json). No active feature → nothing to check.
if ! run stop-hook scope node scripts/harness/scope.mjs; then
  printf '%s\n' "$out" >&2
  exit 2
fi

changed=$(
  {
    git diff --name-only --diff-filter=d HEAD -- src
    git ls-files --others --exclude-standard -- src
  } | grep -E '\.(ts|tsx)$' | sort -u
)
[ -z "$changed" ] && exit 0

# One path per element, so file names with spaces or glob characters stay intact.
mapfile -t files <<<"$changed"
if ! run stop-hook tests npx --no-install vitest related --run --passWithNoTests -- "${files[@]}"; then
  printf 'Tests related to your changes are failing. Fix them before finishing:\n%s\n' \
    "$(printf '%s' "$out" | tail -40)" >&2
  exit 2
fi
if ! run stop-hook doctor npm run --silent doctor; then
  printf 'react-doctor found new errors in changed files:\n%s\n' \
    "$(printf '%s' "$out" | tail -40)" >&2
  exit 2
fi
exit 0
