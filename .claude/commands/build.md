---
description: Build a designed + specced change — reads your latest Claude Design edits, asks for Gate 1 approval, then codes, verifies against the design and opens a PR.
---

# /build

Turns an approved design + spec into code. Follow the `feature-pipeline` skill and
`.claude/skills/feature-pipeline/claude-design.md`.

Argument: `$ARGUMENTS` is the change name (a folder in `openspec/changes/`). If empty and
exactly one change is open, use it; otherwise list them and ask.

## Steps

1. **Re-read the design.** Read the feature's page from the live canvas — the human may have
   edited it since `/feature`. Compare it with `design.md` / `tasks.md` and classify each
   difference (visual or behaviour, see claude-design.md). Behaviour differences → update
   the spec (`proposal.md`, delta specs, `tasks.md`) to match the design.
2. **GATE 1** (skip if `tasks.md` already has a human's `approved:` line, e.g. from a spec PR):

   ```
   Gate 1 — <change-name>   Risk: <tier>   ~<n> reviewable lines
   Builds: <one sentence>
   Design: <canvas link> → page "<feature>" (<k> screens)
   Your design edits since /feature: <none | short list; spec updated for: …>
   Decisions I need (my default in brackets):
     1. <question> [<default>]
   New dependencies: <none | pkg — why>
   Reply "yes" to build, or tell me what to change.
   ```

   Wait for an explicit yes. Then record the answers in `proposal.md` → Open questions and
   replace the last line of `tasks.md` with `approved: <their name>, <date>`. Feedback
   instead of yes → update the design and/or spec, send the brief again.

3. **Snapshot** the approved page into `design/` (artboards, `canvas.json`, `tokens.json`).
   If the design system's tokens changed, update the styling layer's tokens first.
4. **Implement** on branch `feat/<change-name>` with the `openspec-apply-change` skill,
   task by task with tests, matching the artboards. Run `react-reviewer` after a chunk. If the
   conversation is long, ask the human to `/clear` and run `/build <change-name>` again (it
   resumes: approved line present → skip to the first unticked task).
5. **Verify** — `npm run check` and `npm run test:e2e` (includes axe), then the visual
   self-check (screenshots vs artboards). Fix until green; 3 failed attempts at the same
   thing → stop and explain.
6. **Ship + GATE 2** — confirm, push, open a PR filling in every section of
   `.github/pull_request_template.md`, including **Design** (link, screenshots, differences).
   Open it as the feature-pipeline skill says (step 6 → "How to open it"). STOP. Never merge. After the human merges, tell them to run `/finish <change-name>`.
