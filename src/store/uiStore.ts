import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

interface UiState {
  sidebarOpen: boolean
  settingsOpen: boolean
  toasts: Toast[]
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  openSettings: () => void
  closeSettings: () => void
  addToast: (messageOrToast: string | { message: string; type: ToastType }, type?: ToastType) => void
  removeToast: (id: string) => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  settingsOpen: false,
  toasts: [],
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  addToast: (messageOrToast, type = 'info') => {
    const id = crypto.randomUUID()
    const message = typeof messageOrToast === 'string' ? messageOrToast : messageOrToast.message
    const resolvedType = typeof messageOrToast === 'string' ? type : messageOrToast.type
    set((s) => ({ toasts: [...s.toasts, { id, message, type: resolvedType }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
