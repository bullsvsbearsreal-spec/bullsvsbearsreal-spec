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
        // InfoHub brand colors (black & orange-yellow theme inspired by PornHub)
        hub: {
          black: '#000000',
          dark: '#0a0a0a',
          darker: '#111111',
          gray: '#1a1a1a',
          'gray-light': '#2a2a2a',
          'gray-medium': '#3a3a3a',
          yellow: '#FFA500',
          'yellow-light': '#FFD700',
          'yellow-dark': '#FF8C00',
          orange: '#FF6B00',
          white: '#ffffff',
          'gray-text': '#9ca3af',
          'gray-text-light': '#b0b0b0',
        },
        // Semantic colors
        success: '#22c55e',
        danger: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6',
        long: '#22c55e',
        short: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'shimmer': 'shimmer 2s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'ticker': 'ticker 30s linear infinite',
        'gradient': 'gradient 3s ease infinite',
        'border-glow': 'borderGlow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(255, 165, 0, 0.5), 0 0 10px rgba(255, 165, 0, 0.3)' },
          '100%': { boxShadow: '0 0 15px rgba(255, 165, 0, 0.7), 0 0 30px rgba(255, 165, 0, 0.4), 0 0 45px rgba(255, 165, 0, 0.2)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        borderGlow: {
          '0%': { borderColor: 'rgba(255, 165, 0, 0.3)' },
          '100%': { borderColor: 'rgba(255, 165, 0, 0.7)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'shimmer-gradient': 'linear-gradient(90deg, transparent, rgba(255, 165, 0, 0.1), transparent)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
        'card-gradient': 'linear-gradient(180deg, rgba(26, 26, 26, 0.8), rgba(17, 17, 17, 0.9))',
        'orange-gradient': 'linear-gradient(135deg, #FFD700, #FFA500, #FF8C00)',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(255, 165, 0, 0.3)',
        'glow-md': '0 0 20px rgba(255, 165, 0, 0.4)',
        'glow-lg': '0 0 30px rgba(255, 165, 0, 0.5)',
        'glow-xl': '0 0 50px rgba(255, 165, 0, 0.6)',
        'inner-glow': 'inset 0 0 20px rgba(255, 165, 0, 0.1)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.5)',
        'card-hover': '0 8px 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(255, 165, 0, 0.1)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}