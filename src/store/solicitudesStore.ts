import { create } from 'zustand'

interface SolicitudesState {
  pendingCount: number
  setPendingCount: (n: number) => void
}

export const useSolicitudesStore = create<SolicitudesState>()((set) => ({
  pendingCount: 0,
  setPendingCount: (n) => set({ pendingCount: n }),
}))
