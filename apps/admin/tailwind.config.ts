import type { Config } from 'tailwindcss';

/**
 * Admin console palette.
 *
 * Deliberately colder and flatter than the player app: neutral slate surfaces,
 * a single blue primary, and semantic accents reserved for state (success /
 * warning / danger). No gradients, no glow — a console is read, not played.
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
    './src/store/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /** Neutral slate/zinc surfaces — the console chrome. */
        surface: {
          bg: '#0B0E14',
          card: '#111620',
          elevated: '#161C28',
          overlay: '#1C2331',
          hover: '#1A2130',
          border: '#242C3B',
          divider: '#1D2431',
          muted: '#78849A',
          subtle: '#A7B2C4',
          fg: '#E8EDF5',
          DEFAULT: '#111620',
        },
        /** Primary action colour. */
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#172554',
          DEFAULT: '#2563EB',
        },
        success: {
          50: '#F0FDF4',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
          DEFAULT: '#22C55E',
        },
        warning: {
          50: '#FFFBEB',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          DEFAULT: '#F59E0B',
        },
        danger: {
          50: '#FEF2F2',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          DEFAULT: '#EF4444',
        },
        info: {
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          DEFAULT: '#0EA5E9',
        },
        /** Outcome accents — data-only, never decorative. */
        dragon: { 300: '#FCA5A5', 400: '#F87171', 500: '#EF4444', DEFAULT: '#EF4444' },
        tiger: { 300: '#93C5FD', 400: '#60A5FA', 500: '#3B82F6', DEFAULT: '#3B82F6' },
        tie: { 300: '#FCD34D', 400: '#FBBF24', 500: '#F59E0B', DEFAULT: '#F59E0B' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      spacing: {
        'sidebar-w': '16rem',
        'sidebar-collapsed-w': '4.25rem',
        'topbar-h': '3.5rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(0,0,0,0.4)',
        panel: '0 4px 16px -6px rgba(0,0,0,0.6)',
        elevated: '0 12px 40px -12px rgba(0,0,0,0.8)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.98)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'slide-in-left': 'slide-in-left 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slide-down 160ms ease-out',
        'scale-in': 'scale-in 140ms ease-out',
        shimmer: 'shimmer 1.6s linear infinite',
        'pulse-dot': 'pulse-dot 1.8s ease-in-out infinite',
      },
      backgroundImage: {
        shimmer:
          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      gridTemplateColumns: {
        'stat-4': 'repeat(auto-fit, minmax(13rem, 1fr))',
      },
    },
  },
  plugins: [],
};

export default config;
