'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FundingPrefs } from '@/lib/db';

const LS_KEY = 'ih_funding_prefs';

const DEFAULTS: Required<FundingPrefs> = {
  cellColors: false,
  gridSpacing: 'normal',
  hiddenExchanges: [],
  fontSize: 'medium',
  showPredicted: false,
  showLongShort: true,
  showAccumulated: true,
};

function readFromLS(): Required<FundingPrefs> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch {
    // corrupt data
  }
  return { ...DEFAULTS };
}

export function useFundingPrefs() {
  const [prefs, setPrefs] = useState<Required<FundingPrefs>>(DEFAULTS);

  // Load from localStorage on mount
  useEffect(() => {
    setPrefs(readFromLS());
  }, []);

  // Listen for cross-tab / sync updates
  useEffect(() => {
    const handle = (e: StorageEvent) => {
      if (e.key === LS_KEY) setPrefs(readFromLS());
    };
    const handleSync = () => setPrefs(readFromLS());

    window.addEventListener('storage', handle);
    window.addEventListener('user-data-synced', handleSync);
    return () => {
      window.removeEventListener('storage', handle);
      window.removeEventListener('user-data-synced', handleSync);
    };
  }, []);

  const updatePrefs = useCallback((partial: Partial<FundingPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...partial };
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { prefs, updatePrefs };
}
