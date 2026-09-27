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

if ! out=$(npx --no-install eslint --no-warn-ignored "$file" 2>&1); then
  printf 'ESLint errors in %s:\n%s\n' "$file" "$out" | head -40 >&2
  exit 2
fi
if ! out=$(npx --no-install tsc --noEmit --pretty false 2>&1); then
  printf 'Typecheck failed after editing %s:\n%s\n' "$file" "$out" | head -40 >&2
  exit 2
fi
exit 0
