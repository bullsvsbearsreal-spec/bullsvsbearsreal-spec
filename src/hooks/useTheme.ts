'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';

type Theme = 'orange' | 'green';

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
