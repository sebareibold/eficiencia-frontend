import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#F5A623',
        'primary-dark': '#D4880A',
        surface: '#FFFFFF',
        'custom-border': '#E5E7EB',
      },
    },
  },
  plugins: [],
} satisfies Config
