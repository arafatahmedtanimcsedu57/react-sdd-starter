Estimated reviewable lines: ~450 — over 400, so two PRs (A then B), each with its own
check and review. Approving this file approves both.

## A. Roster + identity

- [ ] A.1 `parseTeam`, `whoami`, `isOwner` (`scripts/harness/lib.mjs`) + tests
- [ ] A.2 `@login` owners in `transition`, `findLedgerAnomalies`, `scopeForBranch`, `features owner --set @login` + tests
- [ ] A.3 `ownSection` accepts `## @login`; clock-out uses it + tests
- [ ] A.4 `scripts/harness/team.mjs`: list, `add`, `join`, `codeowners` (keeps `team:check` as `team.mjs check`); `package.json` `team`
- [ ] A.5 `team.json` with the current owner; CLI test for add / join / codeowners (`scripts/harness/team.cli.test.mjs`)
- [ ] A.6 `npm run check` green; react-reviewer PASS; PR A

## B. /kickoff

- [ ] B.1 `.claude/commands/kickoff.md`: read input → draft features → team → proposed split → write → tell teammates
- [ ] B.2 `.claude/commands/orchestrate.md`: owner may be `@login`; points new teammates to `npm run team -- join`
- [ ] B.3 `CLAUDE.md` (eight commands; one-liners → `.claude/rules/commands.md`), `TEAM.md`, `README.md`, `DECISIONS.md`
- [ ] B.4 Dry run on a throwaway branch: a short sample PRD → draft features + split shown, nothing written until approved; then clean up
- [ ] B.5 `npm run check` green; react-reviewer PASS; PR B

approved: <pending>
