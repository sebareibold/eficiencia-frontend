import { useEffect } from 'react'
import { useSettingsStore } from '../store/settingsStore'

// RGB values as space-separated strings for CSS custom properties.
// darkMain/darkDark: dimmer values used when theme === 'dark' to keep yellows
// from appearing overly bright/saturated on dark backgrounds.
const ACCENT_MAP: Record<string, { main: string; dark: string; darkMain: string; darkDark: string }> = {
  '#FBC608': { main: '251 198 8',  dark: '212 168 0',  darkMain: '210 165 0',  darkDark: '170 135 0'  },
  '#F5A623': { main: '245 166 35', dark: '212 136 10', darkMain: '205 145 20', darkDark: '170 115 5'  },
  '#D4880A': { main: '212 136 10', dark: '180 110 5',  darkMain: '185 115 5',  darkDark: '155 90 0'   },
  '#10B981': { main: '16 185 129', dark: '5 150 105',  darkMain: '12 160 110', darkDark: '4 130 90'   },
  '#8B5CF6': { main: '139 92 246', dark: '124 58 237', darkMain: '120 80 220', darkDark: '100 50 200' },
  '#EF4444': { main: '239 68 68',  dark: '220 38 38',  darkMain: '210 60 60',  darkDark: '185 30 30'  },
}

export function useThemeApplier() {
  const { appearance } = useSettingsStore()

  useEffect(() => {
    const root = document.documentElement
    const isDark = appearance.theme === 'dark'

    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    root.setAttribute('data-density', appearance.density)

    const accent = ACCENT_MAP[appearance.accentColor] ?? ACCENT_MAP['#FBC608']
    root.style.setProperty('--color-primary',      isDark ? accent.darkMain : accent.main)
    root.style.setProperty('--color-primary-dark', isDark ? accent.darkDark : accent.dark)
  }, [appearance.theme, appearance.density, appearance.accentColor])
}
