'use client';

import { memo } from 'react';
import { TFS, type TfKey } from '../../lib/types';

interface TimeframeBarProps {
  current: TfKey;
  onChange: (tf: TfKey) => void;
}

function TimeframeBarInner({ current, onChange }: TimeframeBarProps) {
  return (
    <div className="flex items-center gap-[2px] p-[3px] rounded-lg bg-white/[0.03] border border-white/[0.06]">
      {TFS.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
            current === t.key
              ? 'bg-hub-yellow/15 text-hub-yellow'
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
          title={`Press ${TFS.indexOf(t) + 1}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const TimeframeBar = memo(TimeframeBarInner);
