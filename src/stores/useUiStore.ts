import { create } from 'zustand'

interface UiState {
  showForm: boolean
  toggleForm: () => void
}

export const useUiStore = create<UiState>((set) => ({
  showForm: false,
  toggleForm: () => set((s) => ({ showForm: !s.showForm })),
}))
