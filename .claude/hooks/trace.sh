#!/usr/bin/env bash
# Sourced by the hooks. `run <source> <step> <cmd…>` runs a command, leaves its output in
# $out, returns its exit code, and appends one JSON line to .claude/traces/<UTC day>.jsonl
# of the MAIN checkout (gitignored; read it with `npm run trace`), tagged with the branch —
# so a worker worktree's steps outlive the worktree. Tracing never fails a hook.
TRACE_SESSION=${TRACE_SESSION:-}

# Microseconds, or empty on bash < 5 (no EPOCHREALTIME, e.g. macOS /bin/bash); the hooks run
# under `set -u`, so an unset variable here would abort them.
_trace_now() {
  local t=${EPOCHREALTIME:-}
  printf '%s' "${t/[.,]/}"
}

# The main checkout is the parent of the .git every worktree shares; outside git: here.
# (Repos with --separate-git-dir or submodules would trace inside .git — fine for this template.)
_trace_dir() {
  local common
  # git < 2.31 echoes the unknown --path-format back; only trust an absolute path.
  if common=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null) &&
    [[ $common == /* && $common != *$'\n'* ]]; then
    printf '%s/.claude/traces' "$(dirname "$common")"
  else
    printf '.claude/traces'
  fi
}

run() {
  local source=$1 step=$2 start code ms=null
  start=$(_trace_now)
  shift 2
  out=$("$@" 2>&1)
  code=$?
  local end dir branch
  end=$(_trace_now)
  [ -n "$start" ] && [ -n "$end" ] && ms=$(((end - start) / 1000))
  {
    dir=$(_trace_dir)
    branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
    mkdir -p "$dir" &&
      jq -nc --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg session "$TRACE_SESSION" \
        --arg source "$source" --arg step "$step" --argjson exit "$code" --argjson ms "$ms" \
        --arg detail "${TRACE_DETAIL:-}" --arg branch "$branch" \
        '{at: $at, session: $session, source: $source, step: $step, exit: $exit, ms: $ms}
         + (if $branch == "" then {} else {branch: $branch} end)
         + (if $detail == "" then {} else {detail: $detail} end)' \
        >>"$dir/$(date -u +%Y-%m-%d).jsonl"
  } 2>/dev/null
  return "$code"
}
