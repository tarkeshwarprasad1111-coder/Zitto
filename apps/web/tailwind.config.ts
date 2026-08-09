import type { Config } from 'tailwindcss';

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
        /** Dragon side — red / crimson */
        dragon: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
          950: '#450A0A',
          DEFAULT: '#DC2626',
        },
        /** Tiger side — blue / azure */
        tiger: {
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
        /** Tie / premium accent — gold */
        gold: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
          950: '#451A03',
          DEFAULT: '#F59E0B',
        },
        /** Dark premium surfaces */
        surface: {
          bg: '#0A0A0F',
          card: '#13131A',
          elevated: '#1C1C26',
          overlay: '#22222E',
          border: '#2A2A38',
          muted: '#8B8B9E',
          subtle: '#B4B4C6',
          fg: '#F5F5FA',
          DEFAULT: '#13131A',
        },
        success: {
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          DEFAULT: '#22C55E',
        },
        warning: {
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          DEFAULT: '#F59E0B',
        },
        danger: {
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          DEFAULT: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'ui-sans-serif', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top, 0px)',
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        'safe-left': 'env(safe-area-inset-left, 0px)',
        'safe-right': 'env(safe-area-inset-right, 0px)',
        'nav-h': '4.25rem',
        'topbar-h': '3.5rem',
        touch: '2.75rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'glow-dragon': '0 0 24px -4px rgba(220, 38, 38, 0.55)',
        'glow-tiger': '0 0 24px -4px rgba(37, 99, 235, 0.55)',
        'glow-gold': '0 0 24px -4px rgba(245, 158, 11, 0.55)',
        card: '0 1px 2px 0 rgba(0,0,0,0.35), 0 8px 24px -12px rgba(0,0,0,0.65)',
        elevated: '0 8px 32px -8px rgba(0,0,0,0.75)',
      },
      backgroundImage: {
        'gradient-gold': 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 45%, #D97706 100%)',
        'gradient-dragon': 'linear-gradient(135deg, #EF4444 0%, #DC2626 50%, #991B1B 100%)',
        'gradient-tiger': 'linear-gradient(135deg, #3B82F6 0%, #2563EB 50%, #1E40AF 100%)',
        'gradient-surface': 'linear-gradient(180deg, #13131A 0%, #0A0A0F 100%)',
        shimmer:
          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 50%, transparent 100%)',
      },
      keyframes: {
        'card-flip': {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(180deg)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.82', filter: 'brightness(1.25)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'count-tick': {
          '0%': { transform: 'scale(1)' },
          '35%': { transform: 'scale(1.14)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'card-flip': 'card-flip 600ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        shimmer: 'shimmer 1.8s linear infinite',
        'fade-in': 'fade-in 220ms ease-out',
        'slide-up': 'slide-up 280ms cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'count-tick': 'count-tick 900ms ease-out',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
