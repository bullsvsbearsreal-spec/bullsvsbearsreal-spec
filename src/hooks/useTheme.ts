'use client';

import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

function getTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
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
  return useSyncExternalStore(subscribe, getTheme, () => 'dark' as Theme);
}
