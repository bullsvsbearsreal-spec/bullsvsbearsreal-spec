'use client';

import { memo } from 'react';
import type { ViewMode } from '../../lib/types';

interface ViewModeToggleProps {
  current: ViewMode;
  onChange: (mode: ViewMode) => void;
  showHint?: boolean;
  onHintClick?: () => void;
}

function ViewModeToggleInner({ current, onChange, showHint, onHintClick }: ViewModeToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.02]">
        <button
          onClick={() => onChange('price')}
          className={`px-2.5 py-1 text-[10px] font-bold transition-all ${
            current === 'price'
              ? 'bg-hub-yellow/20 text-hub-yellow'
              : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.03]'
          }`}
        >
          $
        </button>
        <button
          onClick={() => onChange('pct')}
          className={`px-2.5 py-1 text-[10px] font-bold transition-all border-l border-white/[0.06] ${
            current === 'pct'
              ? 'bg-hub-yellow/20 text-hub-yellow'
              : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.03]'
          }`}
        >
          %
        </button>
      </div>
      {showHint && (
        <button
          onClick={onHintClick}
          className="px-2 py-1 rounded-lg text-[9px] text-amber-400/70 hover:text-amber-400 hover:bg-amber-400/5 transition animate-pulse"
        >
          Lines overlapping? Try %
        </button>
      )}
    </div>
  );
}

export const ViewModeToggle = memo(ViewModeToggleInner);
