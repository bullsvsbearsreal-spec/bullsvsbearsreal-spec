'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'infohub-theme';
const THEMES = ['orange', 'green', 'blue'] as const;
type Theme = (typeof THEMES)[number];

const THEME_COLORS: Record<Theme, { bg: string; shadow: string; label: string }> = {
  orange: { bg: '#FFA500', shadow: 'rgba(255,165,0,0.5)', label: 'Orange' },
  green:  { bg: '#00DC82', shadow: 'rgba(0,220,130,0.5)', label: 'Green' },
  blue:   { bg: '#7B61FF', shadow: 'rgba(123,97,255,0.5)', label: 'Blue' },
};

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('orange');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved && THEMES.includes(saved)) setTheme(saved);
  }, []);

  const cycle = () => {
    const idx = THEMES.indexOf(theme);
    const next = THEMES[(idx + 1) % THEMES.length];
    setTheme(next);

    if (next === 'orange') {
      delete document.documentElement.dataset.theme;
      localStorage.removeItem(STORAGE_KEY);
    } else {
      document.documentElement.dataset.theme = next;
      localStorage.setItem(STORAGE_KEY, next);
    }
  };

  const c = THEME_COLORS[theme];

  return (
    <button
      onClick={cycle}
      className="relative flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15] transition-colors"
      aria-label={`Theme: ${c.label}. Click to switch.`}
      title={`Theme: ${c.label}`}
    >
      <div
        className="w-2.5 h-2.5 rounded-full transition-all duration-200"
        style={{ background: c.bg, boxShadow: `0 0 6px ${c.shadow}` }}
      />
      <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider hidden sm:inline">
        {c.label}
      </span>
    </button>
  );
}
