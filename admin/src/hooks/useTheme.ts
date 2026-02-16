'use client';

import { useSyncExternalStore } from 'react';

export type Theme = 'orange' | 'green';

const STORAGE_KEY = 'infohub-admin-theme';

function getTheme(): Theme {
  if (typeof document === 'undefined') return 'orange';
  return document.documentElement.dataset.theme === 'green' ? 'green' : 'orange';
}

let listeners: (() => void)[] = [];

function subscribe(cb: () => void) {
  listeners.push(cb);
  const observer = new MutationObserver(() => {
    listeners.forEach((l) => l());
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  return () => {
    listeners = listeners.filter((l) => l !== cb);
    observer.disconnect();
  };
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => 'orange' as Theme);
}

export function toggleTheme(): void {
  // Add transition class for smooth switch
  document.documentElement.classList.add('transitioning');

  const current = getTheme();
  if (current === 'orange') {
    document.documentElement.dataset.theme = 'green';
    localStorage.setItem(STORAGE_KEY, 'green');
  } else {
    delete document.documentElement.dataset.theme;
    localStorage.removeItem(STORAGE_KEY);
  }

  // Remove transition class after animation completes
  setTimeout(() => {
    document.documentElement.classList.remove('transitioning');
  }, 400);
}
