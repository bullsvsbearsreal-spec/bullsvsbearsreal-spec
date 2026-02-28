'use client';
import { useState } from 'react';

const PRESETS = [10_000, 50_000, 100_000, 500_000, 1_000_000];

interface Props { value: number; onChange: (size: number) => void; }

export default function SizeSelector({ value, onChange }: Props) {
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const formatSize = (n: number) => {
    if (n >= 1_000_000) return `$${n / 1_000_000}M`;
    if (n >= 1_000) return `$${n / 1_000}K`;
    return `$${n}`;
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PRESETS.map(size => (
        <button key={size} onClick={() => { onChange(size); setShowCustom(false); }} className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${value === size && !showCustom ? 'bg-hub-yellow text-black' : 'bg-white/[0.05] text-neutral-400 hover:bg-white/[0.08] hover:text-white border border-white/[0.06]'}`}>
          {formatSize(size)}
        </button>
      ))}
      <input
        type="text"
        inputMode="numeric"
        value={showCustom ? custom : ''}
        onFocus={() => setShowCustom(true)}
        onChange={e => { const val = e.target.value.replace(/[^0-9]/g, ''); setCustom(val); const num = parseInt(val); if (num >= 1000) onChange(num); }}
        placeholder="Custom $"
        className={`w-24 px-3 py-1.5 rounded-lg text-xs font-mono bg-white/[0.05] border text-white outline-none transition-colors ${showCustom ? 'border-hub-yellow/50' : 'border-white/[0.06]'}`}
      />
    </div>
  );
}
