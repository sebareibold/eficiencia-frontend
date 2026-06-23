import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ConfiguracionData } from '../api/configuracion.api'

const DEFAULT_SETTINGS = {
  appearance: {
    theme: 'light' as 'light' | 'dark',
    accentColor: '#FBC608',
    density: 'comfortable' as 'compact' | 'comfortable',
  },
  dashboard: {
    showRevenue: true,
    showClients: true,
    showExpenses: true,
    showProfit: true,
    layout: 'grid' as 'grid' | 'compact',
  },
  notifications: {
    emailDestino: '',
    canal: 'app' as 'app' | 'email' | 'both',
    notifVencimientos: true,
    diasAnticipacion: 7,
    notifDeudas: true,
    notifNuevosClientes: false,
    notifNuevosUsuarios: false,
    emailAlAprobarSolicitudes: false,
  },
}

export type AppearanceSettings = typeof DEFAULT_SETTINGS.appearance
export type DashboardSettings = typeof DEFAULT_SETTINGS.dashboard
export type NotificationSettings = typeof DEFAULT_SETTINGS.notifications

interface SettingsState {
  appearance: AppearanceSettings
  dashboard: DashboardSettings
  notifications: NotificationSettings
  hasUnsavedChanges: boolean
  updateAppearance: (updates: Partial<AppearanceSettings>) => void
  updateDashboard: (updates: Partial<DashboardSettings>) => void
  updateNotifications: (updates: Partial<NotificationSettings>) => void
  saveSettings: () => void
  resetToDefaults: () => void
  applyFromServer: (config: Partial<ConfiguracionData>) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      hasUnsavedChanges: false,
      updateAppearance: (updates) =>
        set((s) => ({ appearance: { ...s.appearance, ...updates }, hasUnsavedChanges: true })),
      updateDashboard: (updates) =>
        set((s) => ({ dashboard: { ...s.dashboard, ...updates }, hasUnsavedChanges: true })),
      updateNotifications: (updates) =>
        set((s) => ({ notifications: { ...s.notifications, ...updates }, hasUnsavedChanges: true })),
      saveSettings: () => set({ hasUnsavedChanges: false }),
      resetToDefaults: () => set({ ...DEFAULT_SETTINGS, hasUnsavedChanges: false }),
      applyFromServer: (config) =>
        set((s) => ({
          appearance: {
            ...s.appearance,
            ...(config.tema        !== undefined && { theme:       config.tema as 'light' | 'dark' }),
            ...(config.accentColor !== undefined && { accentColor: config.accentColor }),
            ...(config.density     !== undefined && { density:     config.density as 'compact' | 'comfortable' }),
          },
          notifications: {
            ...s.notifications,
            ...(config.notifEmail            !== undefined && { emailDestino:        config.notifEmail }),
            ...(config.notifCanal            !== undefined && { canal:               config.notifCanal as 'app' | 'email' | 'both' }),
            ...(config.notifVencimientos     !== undefined && { notifVencimientos:   config.notifVencimientos }),
            ...(config.notifDiasAnticipacion !== undefined && { diasAnticipacion:    config.notifDiasAnticipacion }),
            ...(config.notifDeudas           !== undefined && { notifDeudas:         config.notifDeudas }),
            ...(config.notifNuevosClientes   !== undefined && { notifNuevosClientes: config.notifNuevosClientes }),
            ...(config.notifNuevosUsuarios          !== undefined && { notifNuevosUsuarios:          config.notifNuevosUsuarios }),
            ...(config.emailAlAprobarSolicitudes    !== undefined && { emailAlAprobarSolicitudes:    config.emailAlAprobarSolicitudes }),
          },
          hasUnsavedChanges: false,
        })),
    }),
    {
      name: 'eficiencia-settings',
      version: 4,
      migrate: (state: unknown, version: number) => {
        const s = state as Record<string, unknown>
        if (version < 2) {
          return { ...s, notifications: { ...DEFAULT_SETTINGS.notifications } }
        }
        if (version < 3) {
          const notif = (s.notifications as Record<string, unknown>) ?? {}
          return {
            ...s,
            notifications: { ...notif, emailAlAprobarSolicitudes: false },
          }
        }
        if (version < 4) {
          // Resetear tema a 'light' — por decisión del cliente todos arrancan en claro
          const appearance = (s.appearance as Record<string, unknown>) ?? {}
          return {
            ...s,
            appearance: { ...appearance, theme: 'light' },
          }
        }
        return s
      },
      partialize: (state) => ({
        appearance:    state.appearance,
        dashboard:     state.dashboard,
        notifications: state.notifications,
      }),
    },
  ),
)
