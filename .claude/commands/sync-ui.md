---
description: Bring the code in line with your Claude Design edits — diffs the live design against what was last built, codes visual changes, and routes behaviour changes to /build.
---

# /sync-ui

For design edits made **after** a feature was built. Follow
`.claude/skills/feature-pipeline/claude-design.md`.

Argument: `$ARGUMENTS` may name one feature page (slug). Empty → every built page.

## Steps

1. **Diff.** Read the live Design System tokens and canvas, and compare with `design/`
   (`tokens.json`, `canvas.json`, `<slug>/*.dc.html`). Only pages already in `design/` count;
   list unbuilt pages as "not built yet — `/feature` / `/build`". Nothing changed → say so, stop.
2. **Classify** each difference as visual or behaviour (claude-design.md) and show:

   ```
   Design changes since last build
   Visual (I can code these now):
     - add-item / Default · mobile: button radius 12 → 8, label "Add item" → "New item"
     - tokens: color.primary #0E5E5A → #1F4E8C (whole app)
   Behaviour (need a spec + Gate 1):
     - add-item / FormOpen: new "Quantity" field
   Reply "yes" to code the visual changes, or tell me what to change.
   ```

3. **Behaviour changes** → run the `openspec-propose` skill for them (one change per
   feature), then say: "Run `/build <change-name>` for these." Don't code them here.
4. **Visual changes**, on the human's explicit yes:
   - create a small OpenSpec change `ui-sync-<date>` (risk low) listing them; since the human
     just approved the list, end its `tasks.md` with `approved: <their name>, <date>`
   - on branch `chore/ui-sync-<date>`: update tokens in the styling layer, then the
     components; update the affected tests' expected text/roles
   - refresh `design/` for the synced pages and tokens
5. **Verify** — `npm run check`, `npm run test:e2e`, and the visual self-check for the
   affected screens.
6. **Ship + GATE 2** — confirm, push, open a PR (template, including **Design**). STOP.
   After merge: `/finish ui-sync-<date>`.
