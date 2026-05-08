import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
    activity: true,
    newClients: true,
    reports: false,
    frequency: 'instant' as 'instant' | 'daily' | 'weekly',
    channel: 'app' as 'app' | 'email' | 'both',
  },
  system: {
    language: 'es' as 'es' | 'en',
    timezone: 'America/Argentina/Buenos_Aires',
    dateFormat: 'dd/MM/yyyy' as 'dd/MM/yyyy' | 'MM/dd/yyyy' | 'yyyy-MM-dd',
    currency: 'ARS' as 'ARS' | 'USD',
  },
}

export type AppearanceSettings = typeof DEFAULT_SETTINGS.appearance
export type DashboardSettings = typeof DEFAULT_SETTINGS.dashboard
export type NotificationSettings = typeof DEFAULT_SETTINGS.notifications
export type SystemSettings = typeof DEFAULT_SETTINGS.system

interface SettingsState {
  appearance: AppearanceSettings
  dashboard: DashboardSettings
  notifications: NotificationSettings
  system: SystemSettings
  hasUnsavedChanges: boolean
  updateAppearance: (updates: Partial<AppearanceSettings>) => void
  updateDashboard: (updates: Partial<DashboardSettings>) => void
  updateNotifications: (updates: Partial<NotificationSettings>) => void
  updateSystem: (updates: Partial<SystemSettings>) => void
  saveSettings: () => void
  resetToDefaults: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      hasUnsavedChanges: false,
      updateAppearance: (updates) =>
        set((s) => ({
          appearance: { ...s.appearance, ...updates },
          hasUnsavedChanges: true,
        })),
      updateDashboard: (updates) =>
        set((s) => ({
          dashboard: { ...s.dashboard, ...updates },
          hasUnsavedChanges: true,
        })),
      updateNotifications: (updates) =>
        set((s) => ({
          notifications: { ...s.notifications, ...updates },
          hasUnsavedChanges: true,
        })),
      updateSystem: (updates) =>
        set((s) => ({
          system: { ...s.system, ...updates },
          hasUnsavedChanges: true,
        })),
      saveSettings: () => set({ hasUnsavedChanges: false }),
      resetToDefaults: () => set({ ...DEFAULT_SETTINGS, hasUnsavedChanges: false }),
    }),
    { name: 'eficiencia-settings' },
  ),
)
