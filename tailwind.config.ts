import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dynamic accent via CSS custom property (set by useThemeApplier)
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        'primary-dark': 'rgb(var(--color-primary-dark) / <alpha-value>)',
        // Surface and border stay white/gray by default; dark mode CSS overrides them
        surface: '#FFFFFF',
        'custom-border': '#E5E7EB',
      },
    },
  },
  plugins: [],
} satisfies Config
