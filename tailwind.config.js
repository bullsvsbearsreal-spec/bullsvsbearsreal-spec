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
          black: 'var(--hub-black)',
          dark: 'var(--hub-dark)',
          darker: 'var(--hub-darker)',
          gray: 'var(--hub-gray)',
          'gray-light': 'var(--hub-gray-light)',
          'gray-medium': 'var(--hub-gray-medium)',
          // Accent colors — driven by CSS variables for theme switching
          yellow: 'rgb(var(--hub-accent-rgb) / <alpha-value>)',
          'yellow-light': 'rgb(var(--hub-accent-light-rgb) / <alpha-value>)',
          'yellow-dark': 'rgb(var(--hub-accent-dark-rgb) / <alpha-value>)',
          orange: 'rgb(var(--hub-accent-secondary-rgb) / <alpha-value>)',
          white: '#ffffff',
          'gray-text': '#888888',
          'gray-text-light': '#b0b0b0',
        },
        success: '#22c55e',
        danger: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6',
        long: '#22c55e',
        short: '#ef4444',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
        'ticker': 'ticker 30s linear infinite',
        'mesh': 'meshPulse 8s ease-in-out infinite',
        'glow-line': 'glowLine 3s ease-in-out infinite',
        'enter': 'enterUp 0.5s ease-out both',
      },
      keyframes: {
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
