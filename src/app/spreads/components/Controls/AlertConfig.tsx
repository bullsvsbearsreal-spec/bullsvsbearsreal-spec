'use client';

import { memo } from 'react';
import { Bell, BellOff } from 'lucide-react';

interface AlertConfigProps {
  active: boolean;
  threshold: string;
  onToggle: () => void;
  onThresholdChange: (v: string) => void;
}

function AlertConfigInner({ active, threshold, onToggle, onThresholdChange }: AlertConfigProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => {
          if (!active && typeof window !== 'undefined' && 'Notification' in window) {
            Notification.requestPermission();
          }
          onToggle();
        }}
        className={`px-2.5 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition ${
          active
            ? 'bg-hub-yellow/10 border-hub-yellow/20 text-hub-yellow'
            : 'bg-white/[0.04] border-white/[0.08] text-neutral-500'
        }`}
      >
        {active ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
        Alert
      </button>
      {active && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-neutral-600">$</span>
          <input
            value={threshold}
            onChange={e => onThresholdChange(e.target.value)}
            type="number"
            placeholder="100"
            step="10"
            className="w-16 px-1.5 py-1 rounded bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-white outline-none focus:border-hub-yellow/30"
          />
        </div>
      )}
    </div>
  );
}

export const AlertConfig = memo(AlertConfigInner);
