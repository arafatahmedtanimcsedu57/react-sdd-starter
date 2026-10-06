#!/usr/bin/env bash
# PostToolUse (Edit|Write): format the edited file, then lint + typecheck if it is TS/TSX.
# Exit 2 sends stderr back to Claude, so a broken edit gets fixed in the same turn
# (exit 1 would only show the error to the human and Claude would carry on).
set -u
file=$(jq -r '.tool_input.file_path // empty')
{ [ -z "$file" ] || [ ! -f "$file" ]; } && exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

npx --no-install prettier --write --ignore-unknown --log-level warn "$file" >/dev/null 2>&1

case "$file" in
  *.ts | *.tsx) ;;
  *) exit 0 ;;
esac

# A broken environment (wrong Node, missing node_modules) makes eslint/tsc fail for reasons
# unrelated to the edit. Only checked after a failure, so a healthy edit pays nothing.
explain() {
  if ! env_out=$(node scripts/harness/ready.mjs 2>&1); then
    printf '%s\n' "$env_out" >&2
  else
    printf "$1" "$file" "$out" | head -40 >&2
  fi
  exit 2
}
out=$(npx --no-install eslint --no-warn-ignored "$file" 2>&1) || explain 'ESLint errors in %s:\n%s\n'
out=$(npx --no-install tsc --noEmit --pretty false 2>&1) ||
  explain 'Typecheck failed after editing %s:\n%s\n'
exit 0
