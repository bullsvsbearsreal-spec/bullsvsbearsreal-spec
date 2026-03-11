'use client';

import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

function getTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

let listeners: (() => void)[] = [];
let sharedObserver: MutationObserver | null = null;

function subscribe(cb: () => void) {
  listeners.push(cb);

  // Create a single shared MutationObserver — not one per subscriber.
  // Previously each subscriber created its own observer, causing N^2 callback
  // invocations on theme change (each observer fired all N listeners).
  if (!sharedObserver && typeof document !== 'undefined') {
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
    // Disconnect observer when no subscribers remain
    if (listeners.length === 0 && sharedObserver) {
      sharedObserver.disconnect();
      sharedObserver = null;
    }
  };
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => 'dark' as Theme);
}
