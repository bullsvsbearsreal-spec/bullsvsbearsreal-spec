/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#030806',
          dark: '#060d08',
          card: '#0a0f0c',
          border: 'rgba(0, 220, 130, 0.08)',
          'border-hover': 'rgba(0, 220, 130, 0.15)',
          green: '#00DC82',
          'green-dim': 'rgba(0, 220, 130, 0.6)',
        },
      },
    },
  },
  plugins: [],
};
