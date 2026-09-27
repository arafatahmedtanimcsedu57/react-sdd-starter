# Features

What we're building, in the user's words. **Owned by a human** — the agent may draft
entries, but a person confirms each one before it feeds an OpenSpec proposal.

For each feature, write behaviour and states, not implementation. If something is unknown,
write it under "Open questions" rather than letting the agent guess.

---

## App-wide (every page)

**Behaviour**

- Unknown URL: "Page not found" with a link to the home page.
- A page crashes while rendering: "Something went wrong" with a link to reload the home page.
- While a page's code is loading on first visit: "Loading…".
- A request answered with 401 ends the session (the token is cleared).

**Status:** shipped

---

## Items (example — delete when you start your own)

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
