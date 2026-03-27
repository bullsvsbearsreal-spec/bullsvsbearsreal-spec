'use client';

import { useEffect } from 'react';
import type { TfKey } from '../lib/types';
import { DEFAULT_SELECTED } from '../lib/symbols';

const DEFAULT_SEL_KEY = DEFAULT_SELECTED.join(',');

/**
 * Bidirectional URL ↔ state sync.
 * Writes state to URL params on change, reads on mount (via useSpreadState init).
 */
export function useURLSync(sym: string, sel: string[], tf: TfKey) {
  useEffect(() => {
    const p = new URLSearchParams();
    if (sym !== 'BTC') p.set('s', sym);
    if (sel.join(',') !== DEFAULT_SEL_KEY) p.set('ex', sel.join(','));
    if (tf !== 'live') p.set('tf', tf);
    const qs = p.toString();
    const url = qs ? window.location.pathname + '?' + qs : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [sym, sel, tf]);
}
