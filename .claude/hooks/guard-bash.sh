#!/usr/bin/env bash
# PreToolUse (Bash): block the ways code reaches the default branch without a reviewed PR —
# merging, force-pushing, pushing to main/master, editing branch protection. The deny list
# in settings.json only matches command prefixes, so `git push origin HEAD:master` or
# `cd x && gh pr merge 3` slipped past it. Exit 2 blocks the call and tells Claude why.
# GitHub branch protection is still the real backstop; this stops mistakes before it.
set -u
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
[ -z "$cmd" ] && exit 0
. "$(dirname "$0")/lib.sh"
# Read the branch of the checkout the command runs in (a worker's worktree, not main).
cmd_cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')
cd "$(repo_root "$cmd_cwd")" 2>/dev/null || true

block() {
  printf 'Blocked: %s. Push a feature branch and open a PR; a human merges it (CLAUDE.md → Gates).\n' "$1" >&2
  exit 2
}

current=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
re_default='^(refs/heads/)?(main|master)$'
re_force='^(-f|--force|--force-with-lease.*|--force-if-includes|--mirror|\+.*)$'
re_protect_write='[[:space:]](-X|--method|-f|-F|--field|--raw-field|--input)([[:space:]=]|$)'

# Commit messages and heredocs may mention `gh pr merge`; drop quoted text and heredoc
# bodies so only real commands are checked. Text a shell will run is kept: a heredoc fed
# to sh/bash, and the quoted part of `bash -c` / `eval` (quotes become command breaks).
# A false positive there beats a bypass.
re_shell='(^|[^[:alnum:]_])((ba|z)?sh|eval)([[:space:]]|$)'
if [[ ! $cmd =~ (^|[^[:alnum:]_])(ba|z)?sh[^\|\;\&]*\<\< ]]; then
  cmd=$(printf '%s' "$cmd" | perl -0pe 's/<<-?\s*([\x27"]?)(\w+)\1([^\n]*)\n.*?\n\s*\2(?=\n|$)/$3/gs')
fi
unquoted=$(printf '%s' "$cmd" | perl -0pe 's/\x27[^\x27]*\x27/\x27\x27/gs; s/"(?:[^"\\]|\\.)*"/""/gs')
if [[ $unquoted =~ $re_shell ]]; then
  cmd=$(printf '%s' "$cmd" | tr "\"'" '\n\n')
else
  cmd=$unquoted
fi

# Check every command in a chain (&&, ||, ;, |, newline) on its own.
while IFS= read -r part; do
  # Drop leading `(`, env assignments and wrappers so the command word comes first, and
  # normalise `git -C dir` / `git -c k=v` so `git -C . push` is still seen as a push.
  part=$(printf '%s' "$part" | sed -E '
    s/^[[:space:](]+//
    s/^([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+)+//
    s/^((sudo|command|exec|time|env|nohup)[[:space:]]+)+//')
  # `git -C <dir> push` acts on <dir>'s checkout (how the orchestrator pushes a worker's
  # worktree): keep each -C to read that checkout's branch and push target, drop -c k=v.
  in_dir=()
  [[ -n $cmd_cwd ]] && in_dir=(-C "$cmd_cwd")
  while [[ $part =~ ^git[[:space:]]+-([Cc])[[:space:]]+([^[:space:]]+)[[:space:]]*(.*)$ ]]; do
    [[ ${BASH_REMATCH[1]} == C ]] && in_dir+=(-C "${BASH_REMATCH[2]}")
    part="git ${BASH_REMATCH[3]}"
  done

  [[ $part =~ ^gh[[:space:]]+pr[[:space:]]+merge ]] && block "merging a PR"
  if [[ $part =~ ^gh[[:space:]]+api ]]; then
    [[ $part =~ /pulls/[0-9]+/merge|/merges([[:space:]\'\"]|$) ]] && block "merging via the API"
    [[ $part =~ /protection && $part =~ $re_protect_write ]] && block "changing branch protection"
  fi

  [[ $part =~ ^git[[:space:]]+push([[:space:]]|$) ]] || continue
  read -ra args <<<"${part#*push}"
  positional=()
  branch_push=1
  for a in "${args[@]}"; do
    [[ $a =~ $re_force ]] && block "force-pushing ($a)"
    [[ $a =~ ^(--tags|--delete|-d|--all)$ ]] && branch_push=0
    [[ $a == -* ]] && continue
    positional+=("$a")
    dest=${a##*:} # `src:dst` → dst; a bare name pushes to itself
    [[ $dest =~ $re_default ]] && block "pushing to $dest"
  done
  # A bare push goes wherever push.default + upstream send it. A worker branch cut from master
  # may track origin/master, and with push.default=upstream that push lands on master.
  here=$(git "${in_dir[@]}" rev-parse --abbrev-ref HEAD 2>/dev/null || printf '%s' "$current")
  if ((${#positional[@]} < 2 && branch_push)); then
    target=$(git "${in_dir[@]}" rev-parse --abbrev-ref '@{push}' 2>/dev/null || true)
    [[ -n $target && ${target#*/} =~ $re_default ]] && block "pushing to $target (this branch's push target)"
  fi
  # From main/master, a push with no branch named (or naming HEAD) targets main/master.
  if [[ $here =~ $re_default ]]; then
    ((${#positional[@]} < 2)) && block "pushing from $here with no target branch"
    for a in "${positional[@]:1}"; do
      [[ ${a%%:*} == HEAD && $a != *:* ]] && block "pushing HEAD while on $here"
    done
  fi
done < <(printf '%s\n' "$cmd" | sed -E 's/(&&|\|\||;|\||\$\(|`|\{)/\n/g')
exit 0
