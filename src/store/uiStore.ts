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
  serverDown: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  openSettings: () => void
  closeSettings: () => void
  addToast: (messageOrToast: string | { message: string; type: ToastType }, type?: ToastType, duration?: number) => void
  removeToast: (id: string) => void
  setServerDown: (v: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  settingsOpen: false,
  toasts: [],
  serverDown: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  addToast: (messageOrToast, type = 'info', duration = 4000) => {
    const id = crypto.randomUUID()
    const isStr = typeof messageOrToast === 'string'
    const message = isStr
      ? messageOrToast
      : Array.isArray(messageOrToast)
        ? (messageOrToast as unknown as string[]).join(', ')
        : messageOrToast.message
    const resolvedType: ToastType = ((isStr || Array.isArray(messageOrToast))
      ? type
      : (messageOrToast as { message: string; type: ToastType }).type
    ) ?? 'info'
    set((s) => ({ toasts: [...s.toasts, { id, message, type: resolvedType }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, duration)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setServerDown: (v) => set({ serverDown: v }),
}))
