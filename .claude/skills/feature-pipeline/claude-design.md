# Claude Design — how this project uses it

Claude Design (claude.ai Artifacts) is the **source of truth for the UI**. The human edits
designs there directly; the code follows the design. Read this before `/start`'s design
step, `/feature`, `/build` or `/sync-ui`.

## The two artifacts (links live in `architecture.md` → Design)

| Artifact       | Type                            | Holds                                          |
| -------------- | ------------------------------- | ---------------------------------------------- |
| Design System  | Claude Design "Design System"   | tokens: colours, fonts, radius, spacing        |
| Project canvas | Claude Design "Design" (canvas) | one **page per feature**, screens as artboards |

- Create each once (in `/start`), via the Artifact tool: `quickstart` (intent `other` for the
  design system, `design` for the canvas), then publish from the type it names and follow
  that type's instructions. Record both links in `architecture.md` → Design.
- Install the design system on the canvas so every artboard uses its tokens.
- Both are private to the human's claude.ai account until they share them.

## Canvas conventions

- **Page per feature:** page id = the feature's kebab-case slug (e.g. `add-item`), name =
  its `features.md` heading. "Does this feature have a design?" = "does the canvas have
  this page?".
- **Artboards:** `<slug>/<State>.dc.html`, one per state in `features.md` (Default,
  Loading, Empty, Error, …), each with `"page": "<slug>"` and a `title` like
  `"Loading · mobile"`.
- **Widths:** the breakpoints recorded in `architecture.md` → Design (default: mobile 390,
  desktop 1280). Mobile row first, desktop row below.
- **Copy is real:** use the exact strings from `features.md`; never lorem ipsum.
- **Accessible as drawn:** real `<button>`, `<label for>` + `<input>`, text contrast ≥ 4.5:1.
- **Open decisions** go on the page as orange sticky notes, and in the Gate 1 brief.
- A new feature's page reuses the existing pages' look: read one existing artboard first
  and match its header, spacing, buttons, cards and type scale.

## The repo copy: `design/`

`design/` is a copy of the design **as last built**, so CI, autopilot and `/sync-ui` can use it
without claude.ai. Never hand-edit it; only `/build` and `/sync-ui` write it.

```
design/
├── tokens.json              # the design system's tokens at last build
├── canvas.json              # the canvas index at last build
└── <slug>/<State>.dc.html   # each built feature's artboards
```

- `/build` copies the feature's page (its artboards + `canvas.json` + `tokens.json`) into
  `design/` right after Gate 1 approval, before coding.
- `/sync-ui` diffs the live canvas against `design/`; only pages already in `design/` are
  compared (an unbuilt page is `/build`'s job).
- Autopilot and `@claude` build from `design/` only. If a change's screens aren't there,
  they stop with a "Question" issue.

## Tokens flow one way

Design System → `design/tokens.json` → the styling layer recorded in `architecture.md`
(Tailwind 4: the `@theme` block in `src/styles/index.css`). Components use the tokens
(`bg-primary`, `var(--color-primary)`), never hex values copied from an artboard.

## Classifying a design change (`/sync-ui`, and `/build` after human edits)

- **Visual** — colour, font, size, spacing, radius, border, shadow, alignment, order,
  copy text, a token value. Code it directly after the human says "yes".
- **Behaviour** — an input, button, link, screen or state added or removed; a changed
  validation rule or flow. It needs a spec change: update or propose an OpenSpec change and
  go through Gate 1 via `/build`.

## Matching the design in code (`/build`, `/sync-ui`)

- Match the artboard's structure, copy and spacing; map every colour/font/radius to a token.
- **Visual self-check:** after `npm run check`, capture screenshots with Playwright at each
  design width for each state (drive states with MSW handler overrides), save them to
  `openspec/changes/<change>/screenshots/<State>-<width>.png`, open them, and compare with
  the artboards. Fix real differences; at most 3 rounds, then list what's left in the PR
  under "Differences from the design".
- The accessibility check (axe in `e2e/`) must pass; the design must not force a violation —
  if it does, say so at Gate 1 or in the PR instead of shipping it.
