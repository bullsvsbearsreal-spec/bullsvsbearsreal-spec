/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        hub: {
          /* 60% Dominant */
          black: 'var(--hub-black)',
          dark: 'var(--hub-dark)',
          darker: 'var(--hub-darker)',
          /* 30% Secondary */
          secondary: 'var(--hub-secondary)',
          'secondary-light': 'var(--hub-secondary-light)',
          'secondary-medium': 'var(--hub-secondary-medium)',
          /* Backward-compat aliases */
          gray: 'var(--hub-gray)',
          'gray-light': 'var(--hub-gray-light)',
          'gray-medium': 'var(--hub-gray-medium)',
          /* 10% Accent — driven by CSS variables for theme switching */
          yellow: 'rgb(var(--hub-accent-rgb) / <alpha-value>)',
          'yellow-light': 'rgb(var(--hub-accent-light-rgb) / <alpha-value>)',
          'yellow-dark': 'rgb(var(--hub-accent-dark-rgb) / <alpha-value>)',
          orange: 'rgb(var(--hub-accent-secondary-rgb) / <alpha-value>)',
          /* Neutrals */
          white: '#ffffff',
          'gray-text': '#888888',
          'gray-text-light': '#b0b0b0',
        },
        success: '#4ade80',
        danger: '#f87171',
        warning: '#fbbf24',
        info: '#60a5fa',
        long: '#4ade80',
        short: '#f87171',
      },
      borderColor: {
        'hub-subtle': 'var(--hub-border-subtle)',
        'hub-default': 'var(--hub-border)',
        'hub-hover': 'var(--hub-border-hover)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      /* Additive type scale — use these instead of ad-hoc text-[Npx] */
      fontSize: {
        'micro': ['11px', { lineHeight: '14px', letterSpacing: '0.005em' }],
        'tiny':  ['12px', { lineHeight: '16px' }],
        'body':  ['13px', { lineHeight: '18px' }],
        'md':    ['15px', { lineHeight: '22px' }],
        'hl':    ['18px', { lineHeight: '24px', letterSpacing: '-0.01em' }],
        'display-sm': ['22px', { lineHeight: '28px', letterSpacing: '-0.015em' }],
        'display':    ['28px', { lineHeight: '34px', letterSpacing: '-0.02em' }],
        'display-lg': ['40px', { lineHeight: '44px', letterSpacing: '-0.025em' }],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'breathe': 'breathe 3s ease-in-out infinite',
        'breathe-fast': 'breathe 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
        'ticker': 'ticker 30s linear infinite',
        'mesh': 'meshPulse 8s ease-in-out infinite',
        'glow-line': 'glowLine 3s ease-in-out infinite',
        'enter': 'enterUp 0.3s ease-out both',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.6' },
          '50%': { transform: 'scale(1.8)', opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.97)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        meshPulse: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.05)' },
        },
        glowLine: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        enterUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'glow-sm': '0 0 8px rgb(var(--hub-accent-rgb) / 0.2)',
        'glow-md': '0 0 16px rgb(var(--hub-accent-rgb) / 0.25)',
        'glow-lg': '0 0 32px rgb(var(--hub-accent-rgb) / 0.15)',
        'inner-glow': 'inset 0 1px 0 rgb(var(--hub-accent-rgb) / 0.1)',
        'card': '0 1px 3px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3)',
        'card-hover': '0 2px 8px rgba(0,0,0,0.6), 0 12px 32px rgba(0,0,0,0.4), 0 0 1px rgb(var(--hub-accent-rgb) / 0.15)',
      },
    },
  },
  plugins: [],
}
