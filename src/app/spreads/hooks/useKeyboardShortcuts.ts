'use client';

import { useEffect } from 'react';
import type { TfKey } from '../lib/types';

const TF_KEYS: Record<string, TfKey> = {
  '1': 'live',
  '2': '1d',
  '3': '7d',
  '4': '30d',
};

interface KeyboardShortcutOptions {
  onTimeframe: (tf: TfKey) => void;
  onToggleSymPicker: () => void;
  onCloseAll: () => void;
  onToggleCalc: () => void;
  onToggleWs: () => void;
}

export function useKeyboardShortcuts({
  onTimeframe,
  onToggleSymPicker,
  onCloseAll,
  onToggleCalc,
  onToggleWs,
}: KeyboardShortcutOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // 1-4 for timeframes
      if (TF_KEYS[e.key]) {
        e.preventDefault();
        onTimeframe(TF_KEYS[e.key]);
        return;
      }

      // / or S for symbol search
      if (e.key === '/' || (e.key === 's' && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        onToggleSymPicker();
        return;
      }

      // Escape to close dropdowns
      if (e.key === 'Escape') {
        onCloseAll();
        return;
      }

      // C for calculator
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onToggleCalc();
        return;
      }

      // W for WS toggle
      if (e.key === 'w' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onToggleWs();
        return;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onTimeframe, onToggleSymPicker, onCloseAll, onToggleCalc, onToggleWs]);
}
