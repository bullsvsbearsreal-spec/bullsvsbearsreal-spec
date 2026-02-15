'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'infohub-theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'orange' | 'green'>('orange');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'green') setTheme('green');
  }, []);

  const toggle = () => {
    const next = theme === 'orange' ? 'green' : 'orange';
    setTheme(next);

    if (next === 'green') {
      document.documentElement.dataset.theme = 'green';
      localStorage.setItem(STORAGE_KEY, 'green');
    } else {
      delete document.documentElement.dataset.theme;
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <button
      onClick={toggle}
      className="relative w-8 h-4 rounded-full bg-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] transition-colors flex items-center px-0.5"
      aria-label={`Switch to ${theme === 'orange' ? 'green' : 'orange'} theme`}
      title={`Theme: ${theme}`}
    >
      <div
        className={`w-3 h-3 rounded-full transition-all duration-200 ${
          theme === 'orange'
            ? 'translate-x-0 bg-[#FFA500] shadow-[0_0_6px_rgba(255,165,0,0.5)]'
            : 'translate-x-3.5 bg-[#00DC82] shadow-[0_0_6px_rgba(0,220,130,0.5)]'
        }`}
      />
    </button>
  );
}
