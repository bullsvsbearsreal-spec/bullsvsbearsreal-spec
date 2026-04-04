'use client';

import { useSyncExternalStore } from 'react';

export type Theme = 'orange' | 'green';

const STORAGE_KEY = 'infohub-admin-theme';

function getTheme(): Theme {
  if (typeof document === 'undefined') return 'orange';
  return document.documentElement.dataset.theme === 'green' ? 'green' : 'orange';
}

let listeners: (() => void)[] = [];
let sharedObserver: MutationObserver | null = null;

function subscribe(cb: () => void) {
  listeners.push(cb);
  // Create a single shared observer for all subscribers
  if (!sharedObserver) {
    sharedObserver = new MutationObserver(() => {
      listeners.forEach((l) => l());
    });
    sharedObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }
  return () => {
    listeners = listeners.filter((l) => l !== cb);
    if (listeners.length === 0 && sharedObserver) {
      sharedObserver.disconnect();
      sharedObserver = null;
    }
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
    try { localStorage.setItem(STORAGE_KEY, 'green'); } catch {}
  } else {
    delete document.documentElement.dataset.theme;
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  // Remove transition class after animation completes
  setTimeout(() => {
    document.documentElement.classList.remove('transitioning');
  }, 400);
}
