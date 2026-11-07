Estimated reviewable lines: ~260

## 1. Check

- [ ] 1.1 `checkTeamSetup(facts)` + `parseCodeowners(text)` (`scripts/harness/lib.mjs`)
- [ ] 1.2 Tests for both (`scripts/harness/team.test.mjs`)
- [ ] 1.3 `scripts/harness/team.mjs`: gather facts via `gh`, print ✓ / ✗ + FIX; `package.json` `team:check`

## 2. Repo files

- [ ] 2.1 `.github/CODEOWNERS`: both developers (placeholder for X until the username is known)
- [ ] 2.2 `TEAM.md`: onboarding, who approves what, hand-over, conflicts, protection command
- [ ] 2.3 (if approved) `.github/workflows/pr-size.yml`: exclude `**/*.test.mjs`

## 3. Wiring + docs

- [ ] 3.1 `.claude/commands/orchestrate.md`: `npm run team:check` at clock-in
- [ ] 3.2 `README.md` (setup → TEAM.md), `PIPELINE.md` (Gate 2 enforcement), `DECISIONS.md`
- [ ] 3.3 Run `npm run team:check` against this repo and record the result
- [ ] 3.4 `npm run check` green; react-reviewer PASS

approved: <pending>
