'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function OnchainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Onchain] render error:', error);
  }, [error]);

  return (
    <div style={{ padding: '32px 22px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{
        background: 'var(--hub-darker)',
        border: '1px solid rgba(239,68,68,0.25)',
        borderRadius: 14,
        padding: 22,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'rgba(239,68,68,0.10)',
          border: '1px solid rgba(239,68,68,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <AlertTriangle size={18} style={{ color: 'var(--rekt-mild)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: 'var(--fg-default)',
            letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4,
          }}>
            On-chain data unavailable
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.5 }}>
            Upstream provider returned no data. Usually resolves on retry — other pages should work normally.
          </div>
        </div>
        <button
          onClick={reset}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px',
            borderRadius: 8,
            background: 'var(--hub-accent)', color: '#000',
            border: 'none', cursor: 'pointer',
            fontSize: 11, fontWeight: 700,
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}
        >
          <RefreshCw size={12} /> Try again
        </button>
      </div>
    </div>
  );
}
