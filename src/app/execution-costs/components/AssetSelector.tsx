'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { DEFAULT_ASSETS } from '@/lib/execution-costs/symbol-map';

interface Props {
  value: string;
  onChange: (asset: string) => void;
}

export default function AssetSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = DEFAULT_ASSETS.filter(a => a.toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors text-white font-mono text-sm">
        <span className="font-semibold">{value}</span>
        <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-48 max-h-64 overflow-auto rounded-lg bg-[#1a1a1a] border border-white/[0.08] shadow-xl">
          <div className="p-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[0.04]">
              <Search className="w-3.5 h-3.5 text-neutral-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="bg-transparent text-sm text-white outline-none w-full" autoFocus />
            </div>
          </div>
          {filtered.map(asset => (
            <button key={asset} onClick={() => { onChange(asset); setOpen(false); setSearch(''); }} className={`w-full text-left px-3 py-1.5 text-sm hover:bg-white/[0.06] transition-colors ${asset === value ? 'text-hub-yellow font-semibold' : 'text-neutral-300'}`}>
              {asset}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
