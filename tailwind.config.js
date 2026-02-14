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
          black: '#000000',
          dark: '#0a0a0a',
          darker: '#111111',
          gray: '#1a1a1a',
          'gray-light': '#222222',
          'gray-medium': '#2a2a2a',
          yellow: '#FFA500',
          'yellow-light': '#FFD700',
          'yellow-dark': '#FF8C00',
          orange: '#FF6B00',
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
        'page-enter': 'pageEnter 0.4s ease-out forwards',
        'stagger-in': 'staggerIn 0.35s ease-out forwards',
        'flash-green': 'flashGreen 0.6s ease-out forwards',
        'flash-red': 'flashRed 0.6s ease-out forwards',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'count-reveal': 'countReveal 0.4s ease-out forwards',
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
        pageEnter: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        staggerIn: {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        flashGreen: {
          '0%': { backgroundColor: 'rgba(34, 197, 94, 0.15)' },
          '100%': { backgroundColor: 'transparent' },
        },
        flashRed: {
          '0%': { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
          '100%': { backgroundColor: 'transparent' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 165, 0, 0)' },
          '50%': { boxShadow: '0 0 20px 2px rgba(255, 165, 0, 0.08)' },
        },
        countReveal: {
          '0%': { opacity: '0', transform: 'translateY(8px)', filter: 'blur(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
        },
      },
      boxShadow: {
        'glow-sm': '0 0 8px rgba(255, 165, 0, 0.2)',
        'glow-md': '0 0 16px rgba(255, 165, 0, 0.25)',
        'glow-lg': '0 0 24px rgba(255, 165, 0, 0.15), 0 0 48px rgba(255, 165, 0, 0.05)',
        'glow-yellow-sm': '0 0 6px rgba(255, 165, 0, 0.1)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 165, 0, 0.1)',
        'btn-glow': '0 2px 12px rgba(255, 165, 0, 0.25)',
      },
    },
  },
  plugins: [],
}
