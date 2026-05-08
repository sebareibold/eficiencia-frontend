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
        
        // Brand accents
        'eficiencia-yellow': '#FBC608',
        'eficiencia-yellow-dark': '#D4A800',
        
        // SaaS Surface Hierarchy
        'saas-bg': '#F5F4F2',        // Level 1: Page background
        'saas-surface': '#FFFFFF',   // Level 2 & 3: Cards and Modals
        'saas-hover': '#FAFAF8',     // Subtle hover state for interactive elements
        
        // Borders and Divides
        'saas-border': '#E5E3DF',         // Standard borders (cards, tables)
        'saas-border-strong': '#D6D3CE',  // Stronger borders (modals)
        'saas-divider': '#F3F2EF',        // Internal dividers (table rows, modal headers)
        
        // Typography
        'saas-text': '#111827',      // Primary text (gray-900)
        'saas-muted': '#6B7280',     // Muted/Meta text (gray-500)
      },
      boxShadow: {
        'saas-card': '0 1px 3px rgba(0,0,0,0.06)',
        'saas-modal': '0 25px 60px rgba(0,0,0,0.12)',
      },
      backgroundImage: {
        // Very subtle dot grid (24px spacing)
        'saas-dots': 'radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)',
      },
      backgroundSize: {
        'saas-dots': '24px 24px',
      }
    },
  },
  plugins: [],
} satisfies Config
