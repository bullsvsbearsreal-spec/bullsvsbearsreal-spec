'use client';

interface Props { value: 'long' | 'short'; onChange: (dir: 'long' | 'short') => void; }

export default function DirectionToggle({ value, onChange }: Props) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
      <button onClick={() => onChange('long')} className={`px-4 py-1.5 text-xs font-semibold transition-colors ${value === 'long' ? 'bg-green-500/20 text-green-400' : 'bg-white/[0.03] text-neutral-500 hover:text-neutral-300'}`}>
        Long
      </button>
      <button onClick={() => onChange('short')} className={`px-4 py-1.5 text-xs font-semibold transition-colors ${value === 'short' ? 'bg-red-500/20 text-red-400' : 'bg-white/[0.03] text-neutral-500 hover:text-neutral-300'}`}>
        Short
      </button>
    </div>
  );
}
