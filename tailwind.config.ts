import type { Config } from 'tailwindcss';

/**
 * CampusIQ design system
 * ────────────────────────
 * Deep crimson identity over a quiet, academic neutral palette.
 * All semantic colours are CSS variables so light/dark themes share one API.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // semantic surfaces / text
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        raised: 'rgb(var(--raised) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        subtle: 'rgb(var(--subtle) / <alpha-value>)',

        // brand — deep crimson
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
          950: 'rgb(var(--brand-950) / <alpha-value>)',
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          soft: 'rgb(var(--brand-soft) / <alpha-value>)',
          fg: 'rgb(var(--brand-fg) / <alpha-value>)',
        },

        // status
        ok: {
          DEFAULT: 'rgb(var(--ok) / <alpha-value>)',
          soft: 'rgb(var(--ok-soft) / <alpha-value>)',
          fg: 'rgb(var(--ok-fg) / <alpha-value>)',
        },
        warn: {
          DEFAULT: 'rgb(var(--warn) / <alpha-value>)',
          soft: 'rgb(var(--warn-soft) / <alpha-value>)',
          fg: 'rgb(var(--warn-fg) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger) / <alpha-value>)',
          soft: 'rgb(var(--danger-soft) / <alpha-value>)',
          fg: 'rgb(var(--danger-fg) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--info) / <alpha-value>)',
          soft: 'rgb(var(--info-soft) / <alpha-value>)',
          fg: 'rgb(var(--info-fg) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
        },

        // chart series (stable across themes)
        chart: {
          1: 'rgb(var(--chart-1) / <alpha-value>)',
          2: 'rgb(var(--chart-2) / <alpha-value>)',
          3: 'rgb(var(--chart-3) / <alpha-value>)',
          4: 'rgb(var(--chart-4) / <alpha-value>)',
          5: 'rgb(var(--chart-5) / <alpha-value>)',
          6: 'rgb(var(--chart-6) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        sm: '0.3125rem',
        DEFAULT: '0.5rem',
        md: '0.625rem',
        lg: '0.75rem',
        xl: '0.9375rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(16 16 24 / 0.04), 0 1px 1px -1px rgb(16 16 24 / 0.04)',
        pop: '0 12px 32px -8px rgb(16 16 24 / 0.18), 0 2px 8px -2px rgb(16 16 24 / 0.08)',
        inset: 'inset 0 1px 0 0 rgb(255 255 255 / 0.06)',
        focus: '0 0 0 3px rgb(var(--brand) / 0.22)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-soft': {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '.55' },
        },
        'draw-bar': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
        check: {
          '0%': { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in .18s ease-out both',
        'fade-up': 'fade-up .22s cubic-bezier(.22,1,.36,1) both',
        'scale-in': 'scale-in .16s cubic-bezier(.22,1,.36,1) both',
        'slide-in-right': 'slide-in-right .22s cubic-bezier(.22,1,.36,1) both',
        'slide-in-left': 'slide-in-left .22s cubic-bezier(.22,1,.36,1) both',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'draw-bar': 'draw-bar .5s cubic-bezier(.22,1,.36,1) both',
        check: 'check .3s ease-out .05s both',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(.22,1,.36,1)',
      },
      spacing: {
        'sidebar': '16.5rem',
        'sidebar-collapsed': '4.5rem',
      },
    },
  },
  plugins: [],
};


export default config;
