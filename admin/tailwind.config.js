/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        admin: {
          bg: 'var(--admin-bg)',
          'surface-0': 'var(--admin-surface-0)',
          'surface-1': 'var(--admin-surface-1)',
          'surface-2': 'var(--admin-surface-2)',
          border: 'var(--admin-border)',
          'border-hover': 'var(--admin-border-hover)',
          accent: 'var(--admin-accent)',
          'accent-light': 'var(--admin-accent-light)',
          'accent-dark': 'var(--admin-accent-dark)',
        },
        terminal: {
          bg: 'var(--admin-bg)',
          card: 'var(--admin-surface-1)',
          border: 'var(--admin-border)',
          green: 'var(--admin-accent)',
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'Cascadia Code', 'Source Code Pro', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
