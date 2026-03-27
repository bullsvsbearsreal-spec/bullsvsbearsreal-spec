'use client';

import { useEffect } from 'react';
import { fp } from '../lib/spread-math';
import type { SpreadInfo } from '../lib/types';

interface AlertSystemOptions {
  wsSpread: SpreadInfo | null;
  alertActive: boolean;
  alertThreshold: string;
  sym: string;
  lastAlert: string | null;
  onAlert: (msg: string) => void;
  onToast: (msg: string | null) => void;
}

export function useAlertSystem({
  wsSpread,
  alertActive,
  alertThreshold,
  sym,
  lastAlert,
  onAlert,
  onToast,
}: AlertSystemOptions) {
  useEffect(() => {
    if (!alertActive || !wsSpread || !alertThreshold) return;
    const threshold = Number(alertThreshold);
    if (threshold <= 0 || isNaN(threshold)) return;

    if (wsSpread.spread >= threshold) {
      const msg = `${sym} spread $${wsSpread.spread.toFixed(2)} exceeded $${threshold} threshold! ${wsSpread.high.exchange} $${fp(wsSpread.high.price)} vs ${wsSpread.low.exchange} $${fp(wsSpread.low.price)}`;
      if (msg !== lastAlert) {
        onAlert(msg);
        onToast(msg);
        setTimeout(() => onToast(null), 8000);

        // Browser notification
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('InfoHub Spread Alert', { body: msg, icon: '/favicon.ico' });
        }
        // Sound alert
        try { new Audio('/audio/alert.mp3').play().catch(() => {}); } catch {}
      }
    }
  }, [wsSpread, alertActive, alertThreshold, sym, lastAlert, onAlert, onToast]);
}
