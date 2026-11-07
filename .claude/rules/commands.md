# Command names the human sees

The vendored OpenSpec skills (`.claude/skills/openspec-*`) tell the user to run `/opsx:*`
commands. This project doesn't expose those. When a skill says:

| Skill says                          | Tell the human          |
| ----------------------------------- | ----------------------- |
| run `/opsx:propose`                 | `/feature <idea>`       |
| run `/opsx:apply`                   | `/build <change-name>`  |
| run `/opsx:archive` or `/opsx:sync` | `/finish <change-name>` |

Inside `/orchestrate`, the orchestrator runs these steps for each task itself; the human
only answers in the orchestrator's window.
