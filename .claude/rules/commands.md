# Command names the human sees

The human uses exactly these eight (`.claude/commands/`):

| Command                  | What it does                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `/start`                 | once: set up the project + its Claude Design                                              |
| `/kickoff [input]`       | PRD / demo link / feature list → features, team, a split the lead approves; repeatable    |
| `/feature <idea>`        | design + spec, then stop so they can edit the design                                      |
| `/build <change-name>`   | Gate 1 → code → PR                                                                        |
| `/sync-ui [feature]`     | code catches up with design edits                                                         |
| `/finish <change-name>`  | after merge: archive the spec                                                             |
| `/fix <bug>`             | a bug in shipped behaviour: failing test → fix → PR, no design or spec step               |
| `/orchestrate [feature]` | team work: one worker per task in its own worktree, a board, every approval in one window |

The vendored OpenSpec skills (`.claude/skills/openspec-*`) tell the user to run `/opsx:*`
commands. This project doesn't expose those. When a skill says:

| Skill says                          | Tell the human          |
| ----------------------------------- | ----------------------- |
| run `/opsx:propose`                 | `/feature <idea>`       |
| run `/opsx:apply`                   | `/build <change-name>`  |
| run `/opsx:archive` or `/opsx:sync` | `/finish <change-name>` |

Inside `/orchestrate`, the orchestrator runs these steps for each task itself; the human
only answers in the orchestrator's window.
