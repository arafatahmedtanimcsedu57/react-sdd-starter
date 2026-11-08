# Features

What we're building, in the user's words. **Owned by a human** — the agent may draft
entries, but a person confirms each one before it feeds an OpenSpec proposal.

For each feature, write behaviour and states, not implementation. If something is unknown,
write it under "Open questions" rather than letting the agent guess.

Each entry has an **ID** that matches `features.json`, which holds what a script needs:
the proof command, the folders it may touch (scope) and its state. Only
`npm run features` changes that file (see `CLAUDE.md` → Feature list).

---

## App-wide (every page)

**ID:** F01

**Behaviour**

- Unknown URL: "Page not found" with a link to the home page.
- A page crashes while rendering: "Something went wrong" with a link to reload the home page.
- While a page's code is loading on first visit: "Loading…".
- A request answered with 401 ends the session (the token is cleared).

**Status:** shipped

---

## Items (example — delete when you start your own)

**ID:** F02

**Who / why:** A user keeps a short list of items and adds new ones.

**Behaviour**

- The list shows every item by name.
- "Add item" opens a form with one field: Name (required).
- Saving adds the item to the list and clears the form; the form stays open.

**States**

- Loading: "Loading…"
- Empty: "No items yet."
- Load error (network, or the response breaks the contract): "Could not load items."
- Save error: "Could not save the item. Try again." — the typed value is kept.

**Edge cases**

- Blank name → inline validation error, nothing is sent.

**Open questions**

- None.

**Status:** shipped

---

## Sign in and registration

**ID:** F03

**Who / why:** A visitor creates an account or signs in, so they can reach the signed-in
pages (Dashboard, Profile). A signed-in user can sign out.

**Behaviour**

- A visitor can register a new account.
- A registered user can sign in.
- A signed-in user can sign out.
- Opening a page that needs sign-in while signed out goes to the sign-in page.

**States**

- Signing in / registering: to be decided (see Open questions).
- Wrong credentials, account already exists, network error: copy to be decided.

**Edge cases**

- A session that ends (401) signs the user out — already handled app-wide (F01).

**Open questions**

- Registration fields (email + password? name?), password rules, email verification?
- "Forgot password", "remember me", social sign-in (Google / GitHub)?
- After sign-in: always the Dashboard, or back to the page first asked for?
- Backend: a real API with an OpenAPI spec, or a frontend-first contract with mocks?

**Status:** not started

---

## Dashboard

**ID:** F04

**Who / why:** A signed-in user lands here after signing in.

**Behaviour**

- Only signed-in users can open it (see F03).
- Content: to be decided (see Open questions).

**States**

- Loading, empty, error: to be decided with the content.

**Edge cases**

- None known yet.

**Open questions**

- What does the dashboard show (summary numbers, recent activity, shortcuts…)?
- Where does that data come from (which endpoints)?

**Status:** not started

---

## Profile

**ID:** F05

**Who / why:** A signed-in user sees their own account details.

**Behaviour**

- Only signed-in users can open it (see F03).
- Shows the user's own details; which ones is to be decided.

**States**

- Loading, error: copy to be decided.

**Edge cases**

- None known yet.

**Open questions**

- Read-only, or editable? Which fields?
- Avatar? Change password? Delete account?

**Status:** not started
