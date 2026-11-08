Risk tier: medium

Feature: none (template + harness change)

## Why

Every feature registers itself by editing two shared files: a child route in
`src/routes/routes.tsx` and its handlers in `src/mocks/handlers.ts` (plus its reset in the
same file). With several people — or several `/orchestrate` workers — adding features at
once, these are the files every branch touches, so they conflict, and `/orchestrate` has
to run tasks that share them one after another. The API layer already avoids this: each
feature injects its endpoints from its own `src/features/<f>/api.ts`.

## What changes

1. **Routes register themselves.** A page's route lives in its own file,
   `src/routes/<name>.route.tsx`, exporting `route: RouteObject` (lazy page, as today).
   `routes.tsx` collects every `*.route.tsx` with `import.meta.glob` and puts them under the
   root layout. Adding a page never edits `routes.tsx`.
2. **Mocks register themselves.** A feature's MSW handlers live in
   `src/mocks/<feature>.handlers.ts`, exporting `handlers` (and `reset()` if it keeps
   state). `src/mocks/handlers.ts` collects them with `import.meta.glob` and calls every
   `reset` in `resetMockData()`. Adding a mock never edits `handlers.ts`.
3. **The example moves** to the new shape: `src/routes/items.route.tsx`,
   `src/mocks/items.handlers.ts`. `/start` step 3 (remove the example) deletes those two
   files instead of editing the registries.
4. **Rules + harness follow:** `.claude/rules/folder-structure.md`, `msw.md`, `CLAUDE.md`,
   `PIPELINE.md`, `README.md`; `/orchestrate` drops `routes.tsx` / `handlers.ts` from its
   "shared files run one after the other" list (only `e2e/<feature>.spec.ts` stays per feature).
5. **A guard:** a unit test fails when a `*.route.tsx` exports no `route`, or two route
   files claim the same path; a `*.handlers.ts` without `handlers` fails the same way.

Folder layout is unchanged — no new top-level folder; files stay in `src/routes/` and
`src/mocks/`.

## Not in this change

- **Navigation** (menu entries). `RootLayout` has no nav yet; when a project adds one, the
  same pattern applies (`handle: { nav }` on each route). Left to `/start` / the project.
- Contract or API changes: none.

## Open questions

1. **Where feature routes and mocks live** — suggested default: `src/routes/<name>.route.tsx`
   and `src/mocks/<feature>.handlers.ts` (existing folders, no import-direction change).
   Alternative: inside `src/features/<f>/` — would need `features/` to import `routes/`
   pieces, which ESLint forbids today.
2. **Route order** — suggested default: none needed; React Router ranks routes by path
   specificity. Index route: `{ index: true }` in its own file.
3. **Size** — ~150 reviewable lines: one PR.

## Impact

`src/routes/routes.tsx`, `src/routes/items.route.tsx` (new), `src/mocks/handlers.ts`,
`src/mocks/items.handlers.ts` (new), tests; `architecture.md` (Decisions row),
`.claude/rules/{folder-structure,msw}.md`, `.claude/commands/{start,orchestrate}.md`,
`CLAUDE.md`, `PIPELINE.md`, `README.md`, `DECISIONS.md`. No new dependency.
