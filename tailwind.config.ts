import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],

  theme: {
    extend: {
      colors: {
        brand: {
          50: 'rgb(var(--color-brand-50)   / <alpha-value>)',
          100: 'rgb(var(--color-brand-100) / <alpha-value>)',
          200: 'rgb(var(--color-brand-200) / <alpha-value>)',
          300: 'rgb(var(--color-brand-300) / <alpha-value>)',
          400: 'rgb(var(--color-brand-400) / <alpha-value>)',
          500: 'rgb(var(--color-brand-500) / <alpha-value>)',
          600: 'rgb(var(--color-brand-600) / <alpha-value>)',
          700: 'rgb(var(--color-brand-700) / <alpha-value>)',
        },
        neutral: {
          50: 'rgb(var(--color-neutral-50)  / <alpha-value>)',
          100: 'rgb(var(--color-neutral-100) / <alpha-value>)',
          200: 'rgb(var(--color-neutral-200) / <alpha-value>)',
          300: 'rgb(var(--color-neutral-300) / <alpha-value>)',
          400: 'rgb(var(--color-neutral-400) / <alpha-value>)',
          500: 'rgb(var(--color-neutral-500) / <alpha-value>)',
          600: 'rgb(var(--color-neutral-600) / <alpha-value>)',
          700: 'rgb(var(--color-neutral-700) / <alpha-value>)',
          800: 'rgb(var(--color-neutral-800) / <alpha-value>)',
          900: 'rgb(var(--color-neutral-900) / <alpha-value>)',
          950: 'rgb(var(--color-neutral-950) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--color-surface)         / <alpha-value>)',
          muted: 'rgb(var(--color-surface-muted)     / <alpha-value>)',
          raised: 'rgb(var(--color-surface-raised)   / <alpha-value>)',
          inverse: 'rgb(var(--color-surface-inverse) / <alpha-value>)',
        },
        danger: {
          50: 'rgb(var(--color-danger-50)  / <alpha-value>)',
          500: 'rgb(var(--color-danger-500) / <alpha-value>)',
          600: 'rgb(var(--color-danger-600) / <alpha-value>)',
        },
        success: {
          50: 'rgb(var(--color-success-50)  / <alpha-value>)',
          500: 'rgb(var(--color-success-500) / <alpha-value>)',
          700: 'rgb(var(--color-success-700) / <alpha-value>)',
        },
        warning: {
          50: 'rgb(var(--color-warning-50)  / <alpha-value>)',
          500: 'rgb(var(--color-warning-500) / <alpha-value>)',
          700: 'rgb(var(--color-warning-700) / <alpha-value>)',
        },
        canvas: {
          DEFAULT: 'rgb(var(--color-canvas-bg)     / <alpha-value>)',
          shell: 'rgb(var(--color-canvas-shell)  / <alpha-value>)',
          chrome: 'rgb(var(--color-canvas-chrome) / <alpha-value>)',
        },
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        plan: {
          line: 'rgb(var(--color-plan-line)    / <alpha-value>)',
          measure: 'rgb(var(--color-plan-measure) / <alpha-value>)',
          active: 'rgb(var(--color-plan-active)  / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Manrope Variable', 'DM Sans Variable', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono Variable', 'ui-monospace', 'monospace'],
        display: ['Manrope Variable', 'DM Sans Variable', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        paper: 'var(--paper-shadow)',
      },
      spacing: {
        '13': '3.25rem',
        '18': '4.5rem',
        '112': '28rem',
        '128': '32rem',
      },
      keyframes: {
        'flash-success': {
          '0%': { backgroundColor: 'rgb(var(--color-success-500) / 0.08)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'chip-pop': {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '60%': { transform: 'scale(1.03)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'flash-success': 'flash-success 600ms ease-out forwards',
        'fade-up': 'fade-up 240ms cubic-bezier(0.16, 1, 0.3, 1) both',
        'chip-pop': 'chip-pop 220ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      borderRadius: {
        pill: '999px',
      },
    },
  },

  plugins: [],
};

export default config;
