## What changed

<!-- 3 bullets max. What does the user see or get that they didn't before? -->

-
-
-

**OpenSpec change:** `openspec/changes/<change-name>/`
**Part of a split?** <!-- e.g. "2 of 3 — depends on #12" or "No" -->

## Review carefully

<!-- The files/lines where a bug would actually hurt: state logic, data flow, Zod schemas,
     auth, error handling. Link to lines. Say WHY each one is risky. -->

- `path/to/file.ts:L10-L40` — why it matters

## Safe to skim

<!-- Generated code, mocks/fixtures, styling, test boilerplate. -->

-

## How to verify

<!-- Preview URL + click-through steps a reviewer can follow in under 2 minutes. -->

1. Open the Vercel preview
2.
3.

## Checklist

- [ ] `npm run typecheck && npm run lint && npm run test && npm run doctor` passes
- [ ] Tests cover the behaviour in the spec (read these first)
- [ ] PR size check is green, or `large-pr-approved` is justified below
- [ ] No hardcoded secrets; user input validated with Zod
