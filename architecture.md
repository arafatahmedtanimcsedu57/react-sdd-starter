# Architecture

Tech decisions and design tokens. **Owned by a human.** The agent reads this before writing
UI or data code and must not change a decision here without asking. Each decision records
who made it and when, so a later reader knows it was deliberate.

## Decisions

| Area                         | Decision                                       | Decided by / date |
| ---------------------------- | ---------------------------------------------- | ----------------- |
| Framework                    | Vite 8 + React 19 + TypeScript 6 (strict)      | starter default   |
| Styling                      | Tailwind CSS 4                                 | starter default   |
| UI component library         | None yet — hand-built components               | starter default   |
| Server state / data fetching | RTK Query (fixed rule, see CLAUDE.md)          | starter default   |
| Client / UI state            | Zustand (fixed rule)                           | starter default   |
| Forms + validation           | React Hook Form + Zod (fixed rule)             | starter default   |
| Routing                      | React Router 7, lazy route per page            | starter default   |
| Config / env                 | `VITE_*` validated by Zod in `src/lib/env.ts`  | starter default   |
| Auth transport               | Bearer token, held in memory (Zustand)         | starter default   |
| Quality floors               | Coverage ≥80% lines; ≤180 kB gzip per JS chunk | starter default   |
| Error tracking               | Sentry, lazy-loaded, on only when DSN is set   | starter default   |

Replace "starter default" with a name and date when your team confirms or changes a row.

## API contract

| Domain | Source                                        | Case (CLAUDE.md)   | Mocked? |
| ------ | --------------------------------------------- | ------------------ | ------- |
| items  | Zod schemas in `src/features/items/schema.ts` | 3 — frontend-first | MSW     |

When a real backend ships, record its base URL and who owns the contract on that side.

| Environment | `VITE_API_URL`          | Owner |
| ----------- | ----------------------- | ----- |
| local       | `/api` (mocks or proxy) |       |
| staging     | _unset_                 |       |
| production  | _unset_                 |       |

## Design (Claude Design)

| Artifact       | Link                         |
| -------------- | ---------------------------- |
| Design System  | _not created yet — `/start`_ |
| Project canvas | _not created yet — `/start`_ |

Breakpoints designed for: mobile 390, desktop 1280.
The repo copy of what's built lives in `design/` — see CLAUDE.md → UI design.

## Design tokens

Tokens come from the Design System above and flow into the `@theme` block in `src/styles/index.css` (Tailwind 4). Never hand-copy values into
components.

| Token         | Value   | Notes |
| ------------- | ------- | ----- |
| color.primary | _unset_ |       |
| font.body     | _unset_ |       |
| radius.base   | _unset_ |       |

## Open decisions

Things the team hasn't settled yet. The agent asks about these instead of picking one.

- UI component library (shadcn/ui is the natural fit with Tailwind).
- Hosting / preview deploys (docs assume Vercel; nothing is wired yet). Whatever host is
  chosen must serve `index.html` for unknown paths (SPA fallback) or deep links will 404.
- Token refresh: `src/services/baseQuery.ts` signs out on 401; refresh-and-retry needs the
  backend's refresh endpoint.
- Error monitoring (e.g. Sentry) — `RouteError` logs to the console only.
