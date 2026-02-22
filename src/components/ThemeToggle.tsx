'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'infohub-theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light') setTheme('light');
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);

    if (next === 'light') {
      document.documentElement.dataset.theme = 'light';
      localStorage.setItem(STORAGE_KEY, 'light');
    } else {
      delete document.documentElement.dataset.theme;
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <button
      onClick={toggle}
      className="relative w-8 h-4 rounded-full bg-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] transition-colors flex items-center px-0.5"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch theme (current: ${theme})`}
    >
      <div
        className={`w-3 h-3 rounded-full transition-all duration-200 ${
          theme === 'dark'
            ? 'translate-x-0 bg-[#FFA500] shadow-[0_0_6px_rgba(255,165,0,0.5)]'
            : 'translate-x-3.5 bg-[#FFD700] shadow-[0_0_6px_rgba(255,215,0,0.5)]'
        }`}
      />
    </button>
  );
}
