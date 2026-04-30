import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],

  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F1F5F2',
          500: '#1A6B4A',
          600: '#155A3E',
          700: '#0F4631',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F8F6F1', // warm off-white background
          inverse: '#1C1C1A',
        },
        danger: {
          500: '#DC2626',
          600: '#B91C1C',
        },
        success: {
          500: '#059669',
        },
        warning: {
          500: '#D97706',
        },
      },
      fontFamily: {
        sans: ['DM Sans Variable', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono Variable', 'ui-monospace', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '112': '28rem',
        '128': '32rem',
      },
      borderRadius: {
        pill: '999px',
      },
    },
  },

  plugins: [],
};

export default config;
