import { useEffect } from 'react'
import { useSettingsStore } from '../store/settingsStore'

// Space-separated RGB values for CSS custom properties
const ACCENT_MAP: Record<string, { main: string; dark: string }> = {
  '#F5A623': { main: '245 166 35', dark: '212 136 10' },
  '#3B82F6': { main: '59 130 246', dark: '37 99 235' },
  '#10B981': { main: '16 185 129', dark: '5 150 105' },
  '#8B5CF6': { main: '139 92 246', dark: '124 58 237' },
  '#EF4444': { main: '239 68 68', dark: '220 38 38' },
}

export function useThemeApplier() {
  const { appearance } = useSettingsStore()

  useEffect(() => {
    const root = document.documentElement

    // Dark mode via class (Tailwind darkMode: 'class')
    if (appearance.theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    // Density via data-attribute
    root.setAttribute('data-density', appearance.density)

    // Dynamic accent color as CSS custom properties
    const accent = ACCENT_MAP[appearance.accentColor] ?? ACCENT_MAP['#F5A623']
    root.style.setProperty('--color-primary', accent.main)
    root.style.setProperty('--color-primary-dark', accent.dark)
  }, [appearance.theme, appearance.density, appearance.accentColor])
}
