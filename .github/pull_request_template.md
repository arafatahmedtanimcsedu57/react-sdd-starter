## What changed

<!-- 3 bullets max. What does the user see or get that they didn't before? -->

-
-
-

**OpenSpec change:** `openspec/changes/<change-name>/`
**Part of a split?** <!-- e.g. "2 of 3 — depends on #12" or "No" -->
**Risk tier:** <!-- low | medium | high — copy from proposal.md; see CLAUDE.md → Human in the loop -->
**Written by:** <!-- human | agent (local) | agent (autopilot / @claude) -->

## Design

<!-- UI changes only; otherwise "No UI". -->

**Claude Design:** <!-- canvas link → page "<feature>" -->
**Screenshots:** `openspec/changes/<change-name>/screenshots/`
**Differences from the design:** <!-- "None", or each one and why -->

## Review carefully

<!-- The files/lines where a bug would actually hurt: state logic, data flow, Zod schemas,
     auth, error handling. Link to lines. Say WHY each one is risky. -->

- `path/to/file.ts:L10-L40` — why it matters

## Decisions I made without asking

<!-- Agent-written PRs: every judgement call the spec didn't settle (naming, UX copy, an edge
     case, a fallback). The reviewer confirms or overrules each one. Write "None" if none. -->

-

## Safe to skim

<!-- Generated code, mocks/fixtures, styling, test boilerplate. -->

-

## How to verify

<!-- Preview URL + click-through steps a reviewer can follow in under 2 minutes. -->

1. Open the preview deploy
2.
3.

## Checklist

- [ ] `npm run check` passes (typecheck, lint, format, test, doctor)
- [ ] Tests cover the behaviour in the spec (read these first)
- [ ] PR size check is green, or `large-pr-approved` is justified below
- [ ] No hardcoded secrets; user input validated with Zod
- [ ] No new dependency, or it was approved at Gate 1
- [ ] UI matches the Claude Design artboards (screenshots attached); axe reports no violations

### Reviewer (human)

- [ ] I clicked through the preview, not just the diff
- [ ] I answered every item under "Decisions I made without asking"
- [ ] Anything I had to correct twice is proposed as a `CLAUDE.md` rule
