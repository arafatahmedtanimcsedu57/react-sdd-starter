---
description: After a PR is merged — archive its OpenSpec change into the living specs and mark the feature shipped.
---

# /finish

Closes out one change after the human has merged its PR (Gate 2 passed).

Argument: `$ARGUMENTS` is the change name (a folder in `openspec/changes/`). If empty, list
the open changes and ask which one — never guess.

## Steps

1. **Check it's merged.** Switch to the default branch and pull. The change's PR must be
   merged; if its code isn't on the default branch yet, stop and say so.
2. **Archive.** Run the `openspec-archive-change` skill for the change, syncing its delta
   specs into `openspec/specs/` (it runs the `openspec-sync-specs` workflow inline).
3. **Mark shipped.** Update the feature's entry in `features.md`.
4. **Ship the bookkeeping.** On a new branch `chore/archive-<change>`, commit the archive +
   `features.md` update and open a small PR (confirm before pushing). Never push to the
   default branch.
5. **Learn.** Look back at what the human corrected at both gates. If a correction repeats,
   propose a one-line `CLAUDE.md` rule; add it only if they agree.

Report what moved where, the PR link, and stop.
