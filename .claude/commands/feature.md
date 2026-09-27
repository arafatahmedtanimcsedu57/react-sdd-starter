---
description: Design and spec one feature or change — reuses its Claude Design page if it exists, otherwise designs it in the project's theme. Stops for you to edit the design; then run /build.
---

# /feature

Plans a single change: intent → design → spec. It does **not** write application code —
`/build` does, after the human has looked at (and maybe edited) the design.
Follow the `feature-pipeline` skill and `.claude/skills/feature-pipeline/claude-design.md`.

Argument: `$ARGUMENTS` is the feature/change description. If empty, ask what to build.
If it names an existing folder in `openspec/changes/`, show that change's status (design
link, open questions, approved or not) and the next command to run. Stop.

## Behaviour

- Move briskly on routine, reversible steps (spec files, design artboards). Confirm before
  installs, pushes or PRs.
- Stop and ask on the triggers in `CLAUDE.md` → Human in the loop. One question, with your
  recommended answer.

## Steps

1. **Define** — capture intent in `features.md` (behaviour, states, edge cases, open
   questions). For small changes, a one-line note is fine. If the change touches an API,
   **establish the contract first** (`CLAUDE.md` → API contracts).
2. **Design check** — read the project canvas (link in `architecture.md` → Design) and look
   for this feature's page.
   - **Page exists** → use it as is. List its artboards.
   - **No page** → design it on the canvas: a new page, one artboard per state per width,
     using the installed design system and the look of the existing pages.
   - **No UI in this change** (pure logic, API, config) → skip design and say so.
   - **No canvas yet** (setup skipped it) → ask whether to create it now (default yes).
3. **Spec** — run the `openspec-propose` skill. `design.md` lists the artboards the change
   implements (`<slug>/<State>.dc.html`). If it will exceed 400 reviewable lines, split it
   (see the skill). `tasks.md` ends with `approved: <pending>`.
4. **Hand over** — send, then STOP:

   ```
   Designed + specced — <change-name>   Risk: <tier>   ~<n> reviewable lines
   Design: <canvas link> → page "<feature>" (<k> screens)
   Open decisions (my default in brackets, also on the canvas as notes):
     1. <question> [<default>]
   Edit the design on claude.ai if you want, then run `/build <change-name>`.
   ```
