---
paths:
  - 'src/stores/**'
  - 'src/features/*/store.ts'
---

# Zustand — code pattern

Rules are in `CLAUDE.md` → State, data fetching & forms.

```ts
// src/stores/useUiStore.ts
import { create } from 'zustand'

interface UiState {
  sidebarOpen: boolean
  toggleSidebar: () => void
}
export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}))

// usage — narrow selector, not the whole store:
// const open = useUiStore((s) => s.sidebarOpen)
```
