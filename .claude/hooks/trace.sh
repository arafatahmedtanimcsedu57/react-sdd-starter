#!/usr/bin/env bash
# Sourced by the hooks. `run <source> <step> <cmd…>` runs a command, leaves its output in
# $out, returns its exit code, and appends one JSON line to .claude/traces/<UTC day>.jsonl
# (gitignored; read it with `npm run trace`). Tracing never fails a hook.
TRACE_SESSION=${TRACE_SESSION:-}

run() {
  local source=$1 step=$2 start=${EPOCHREALTIME/[.,]/} code
  shift 2
  out=$("$@" 2>&1)
  code=$?
  local ms=$(((${EPOCHREALTIME/[.,]/} - start) / 1000))
  {
    mkdir -p .claude/traces &&
      jq -nc --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg session "$TRACE_SESSION" \
        --arg source "$source" --arg step "$step" --argjson exit "$code" --argjson ms "$ms" \
        --arg detail "${TRACE_DETAIL:-}" \
        '{at: $at, session: $session, source: $source, step: $step, exit: $exit, ms: $ms}
         + (if $detail == "" then {} else {detail: $detail} end)' \
        >>".claude/traces/$(date -u +%Y-%m-%d).jsonl"
  } 2>/dev/null
  return "$code"
}
