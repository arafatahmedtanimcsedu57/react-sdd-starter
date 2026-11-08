Estimated reviewable lines: ~450 — over 400, so two PRs (A then B), each with its own
check and review. Approving this file approves both.

## A. Roster + identity

- [x] A.1 `parseTeam`, `whoami`, `isOwner` (`scripts/harness/lib.mjs`) + tests
- [x] A.2 `@login` owners in `transition`, `findLedgerAnomalies`, `scopeForBranch`, `features owner --set @login` + tests
- [x] A.3 `ownSection` accepts `## @login`; clock-out uses it + tests
- [x] A.4 `scripts/harness/roster.mjs` (`npm run team`): list, `add`, `join`, `codeowners`; `team:check` stays `team.mjs`
- [x] A.5 `team.json` with the current owner; CLI test for add / join / codeowners (`scripts/harness/team.cli.test.mjs`)
- [ ] A.6 `npm run check` green; react-reviewer PASS; PR A

## B. /kickoff

- [x] B.1 `.claude/commands/kickoff.md`: read input → draft features → team → proposed split → write → tell teammates
- [x] B.2 `.claude/commands/orchestrate.md`: owner may be `@login`; points new teammates to `npm run team -- join`
- [x] B.3 `CLAUDE.md` (eight commands; one-liners → `.claude/rules/commands.md`), `TEAM.md`, `README.md`, `DECISIONS.md`
- [x] B.4 Dry run on a throwaway branch: a short sample PRD → draft features + split shown, nothing written until approved; then clean up
- [ ] B.5 `npm run check` green; react-reviewer PASS; PR B

approved: arafatahmedtanimcsedu57, 2026-11-08
