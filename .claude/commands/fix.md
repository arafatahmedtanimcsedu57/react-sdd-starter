---
description: Fix a bug in behaviour that is already specified and shipped — failing test first, minimal fix, small PR. No design or spec step; anything bigger goes to /feature.
---

# /fix

The light lane for bugs. The **failing test is the spec**, so there is no Gate 1 — but Gate 2
(PR review) still applies. Follow the conventions in `CLAUDE.md`.

Argument: `$ARGUMENTS` is the bug: what happens, what should happen, how to reproduce, or an
issue link. If it's empty or too vague to reproduce, ask for the steps. Stop.

## Does it qualify?

Use `/fix` only when **all** of these hold. If any fails, say which one and tell the human
to run `/feature <description>` instead. Stop.

- The correct behaviour is already stated in `openspec/specs/` or `features.md` (the app
  breaks a promise it already made). If the spec is silent or wrong, it's a behaviour
  change, not a bug.
- No new screen, state or design change (a broken style that no longer matches `design/`
  counts as a bug).
- No change to the API contract (a Zod schema, an endpoint, a response shape).
- No new dependency.
- Around 100 reviewable lines or fewer.

## Steps

1. **Reproduce.** Find the spec line the bug breaks and the code path behind it. Delegate
   the search to `codebase-explorer` if it isn't obvious.
2. **Branch** `fix/<short-slug>` from the updated default branch.
3. **RED** — write a test that reproduces the bug at the lowest layer that can show it
   (unit > component > e2e). Run it and confirm it fails for the **reason in the report**,
   not a setup error. If you can't make it fail, stop and tell the human what you tried.
4. **GREEN** — the smallest change that makes it pass. No refactors, renames or cleanups
   outside the bug's path; note any you spotted for a later `/feature`.
5. **Spec gap?** If the bug happened because the spec missed a case (e.g. an empty list),
   add that scenario to the capability's `openspec/specs/<capability>/spec.md` in the same
   PR, so the living spec matches the fix.
6. **Verify** — `npm run check`, plus `npm run test:e2e` if a user flow is touched. Same
   self-correct rules as `/build`: fix red, stop after 3 failed attempts on the same check.
7. **PR** — confirm before pushing. Fill in `.github/pull_request_template.md`, with
   **OpenSpec change:** `none — /fix (restores openspec/specs/<capability>)` and a risk tier
   from `CLAUDE.md` → Human in the loop. "Review carefully" names the fixed line and the
   test that proves it.
8. **STOP at Gate 2.** Send the PR link, the root cause in one sentence, and the test that
   now guards it. Do not merge. No `/finish` is needed — there's no change folder to archive.
