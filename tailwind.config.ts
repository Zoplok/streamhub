import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Kick-inspired lime green
        brand: {
          50: '#f0ffe0',
          100: '#ddffb3',
          200: '#c4ff80',
          300: '#a9ff4d',
          400: '#86f523',
          500: '#53fc18',
          600: '#3ad80c',
          700: '#2ba808',
          800: '#1f7a08',
          900: '#155308'
        },
        // Deep, saturated YouTube-ish neutrals
        surface: {
          0: 'rgb(var(--surface-0) / <alpha-value>)',
          1: 'rgb(var(--surface-1) / <alpha-value>)',
          2: 'rgb(var(--surface-2) / <alpha-value>)',
          3: 'rgb(var(--surface-3) / <alpha-value>)',
          4: 'rgb(var(--surface-4) / <alpha-value>)',
          5: 'rgb(var(--surface-5) / <alpha-value>)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 0 2px rgba(83,252,24,0.25), 0 6px 24px -8px rgba(83,252,24,0.35)'
      },
      keyframes: {
        'live-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.7)' },
          '50%': { boxShadow: '0 0 0 6px rgba(239, 68, 68, 0)' }
        }
      },
      animation: {
        'live-pulse': 'live-pulse 1.6s ease-out infinite'
      }
    }
  },
  plugins: []
}

export default config
