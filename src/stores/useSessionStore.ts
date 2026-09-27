import { create } from 'zustand'

// The signed-in session. The token lives in memory only (not localStorage), so an XSS bug
// can't read it from storage. If your backend uses httpOnly cookies instead, delete the token
// and set `credentials: 'include'` in src/services/baseQuery.ts.
interface SessionState {
  token: string | null
  signIn: (token: string) => void
  signOut: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  token: null,
  signIn: (token) => set({ token }),
  signOut: () => set({ token: null }),
}))
