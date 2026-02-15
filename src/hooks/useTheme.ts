'use client';

import { useSyncExternalStore } from 'react';

export type Theme = 'orange' | 'green' | 'blue';

function getTheme(): Theme {
  if (typeof document === 'undefined') return 'orange';
  const t = document.documentElement.dataset.theme;
  if (t === 'green') return 'green';
  if (t === 'blue') return 'blue';
  return 'orange';
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
