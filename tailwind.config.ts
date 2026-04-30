import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],

  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1D4ED8', // blue-700  — primary actions and headings
          secondary: '#7C3AED', // violet-600 — secondary accents
          accent: '#F59E0B', // amber-500  — highlights / warnings
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F9FAFB', // gray-50   — page backgrounds
          subtle: '#F3F4F6', // gray-100  — card backgrounds
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '112': '28rem',
        '128': '32rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },

  plugins: [],
};

export default config;
