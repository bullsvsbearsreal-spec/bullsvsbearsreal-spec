'use client';

import { useTheme, toggleTheme } from '@/hooks/useTheme';

export default function ThemeToggle() {
  const theme = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative w-9 h-[18px] rounded-full border flex items-center px-[3px] transition-colors"
      style={{
        background: 'var(--admin-surface-0)',
        borderColor: 'var(--admin-border-hover)',
      }}
      aria-label={`Switch to ${theme === 'orange' ? 'green' : 'orange'} theme`}
      title={`Theme: ${theme}`}
    >
      <div
        className="w-3 h-3 rounded-full transition-all duration-200"
        style={{
          transform: theme === 'orange' ? 'translateX(0)' : 'translateX(14px)',
          background: theme === 'orange' ? '#FFA500' : '#00DC82',
          boxShadow: theme === 'orange'
            ? '0 0 6px rgba(255, 165, 0, 0.5)'
            : '0 0 6px rgba(0, 220, 130, 0.5)',
        }}
      />
    </button>
  );
}
