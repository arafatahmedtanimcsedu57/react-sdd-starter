#!/usr/bin/env bash
# Stop: before Claude ends a turn, check the changes stay inside the active feature's scope,
# then run the tests related to changed source files and react-doctor on them. Failures go
# back to Claude (exit 2) once; if the retry still fails, the turn ends and the human sees
# the red result.
set -u
input=$(cat)
[ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# Wrong Node or stale node_modules makes every later check fail with a misleading stack
# trace. Say so plainly instead; ready.mjs needs nothing installed to run.
if ! out=$(node scripts/harness/ready.mjs 2>&1); then
  printf '%s\n' "$out" >&2
  exit 2
fi

# WIP=1 covers files too: everything changed on this branch must sit inside the active
# feature's scope (features.json). No active feature → nothing to check.
if ! out=$(node scripts/harness/scope.mjs 2>&1); then
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
if ! out=$(npx --no-install vitest related --run --passWithNoTests -- "${files[@]}" 2>&1); then
  printf 'Tests related to your changes are failing. Fix them before finishing:\n%s\n' \
    "$(printf '%s' "$out" | tail -40)" >&2
  exit 2
fi
if ! out=$(npm run --silent doctor 2>&1); then
  printf 'react-doctor found new errors in changed files:\n%s\n' \
    "$(printf '%s' "$out" | tail -40)" >&2
  exit 2
fi
exit 0
