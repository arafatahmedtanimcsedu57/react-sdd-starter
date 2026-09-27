# Architecture

Tech decisions and design tokens. **Owned by a human.** The agent reads this before writing
UI or data code and must not change a decision here without asking. Each decision records
who made it and when, so a later reader knows it was deliberate.

## Decisions

| Area                         | Decision                                      | Decided by / date |
| ---------------------------- | --------------------------------------------- | ----------------- |
| Framework                    | Vite 8 + React 19 + TypeScript 6 (strict)     | starter default   |
| Styling                      | Tailwind CSS 4                                | starter default   |
| UI component library         | None yet — hand-built components              | starter default   |
| Server state / data fetching | RTK Query (fixed rule, see CLAUDE.md)         | starter default   |
| Client / UI state            | Zustand (fixed rule)                          | starter default   |
| Forms + validation           | React Hook Form + Zod (fixed rule)            | starter default   |
| Routing                      | None yet — add react-router at first 2nd page | starter default   |

Replace "starter default" with a name and date when your team confirms or changes a row.

## API contract

| Domain | Source                                        | Case (CLAUDE.md)   | Mocked? |
| ------ | --------------------------------------------- | ------------------ | ------- |
| items  | Zod schemas in `src/features/items/schema.ts` | 3 — frontend-first | MSW     |

When a real backend ships, record its base URL and who owns the contract on that side.

## Design tokens

Tokens flow into the `@theme` block in `src/styles/index.css` (Tailwind 4). Never hand-copy values into
components.

| Token         | Value   | Notes |
| ------------- | ------- | ----- |
| color.primary | _unset_ |       |
| font.body     | _unset_ |       |
| radius.base   | _unset_ |       |

## Open decisions

Things the team hasn't settled yet. The agent asks about these instead of picking one.

- UI component library (shadcn/ui is the natural fit with Tailwind).
- Hosting / preview deploys (docs assume Vercel; nothing is wired yet).
