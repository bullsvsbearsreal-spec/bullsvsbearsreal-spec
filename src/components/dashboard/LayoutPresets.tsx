'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, BarChart3, Briefcase, Layers } from 'lucide-react';
import { type WidgetLayout } from './types';

interface Preset {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  layout: WidgetLayout[];
}

const PRESETS: Preset[] = [
  {
    id: 'trader',
    name: 'Trader',
    description: 'Market-focused with funding, OI & liquidations',
    icon: <BarChart3 className="w-3.5 h-3.5" />,
    layout: [
      { id: 'p1', type: 'btc-price', w: 1, h: 1 },
      { id: 'p2', type: 'long-short', w: 1, h: 1 },
      { id: 'p3', type: 'liquidations', w: 1, h: 1 },
      { id: 'p4', type: 'funding-heatmap', w: 2, h: 1 },
      { id: 'p5', type: 'top-movers', w: 1, h: 1 },
      { id: 'p6', type: 'oi-chart', w: 2, h: 1 },
      { id: 'p7', type: 'trending', w: 1, h: 1 },
    ],
  },
  {
    id: 'investor',
    name: 'Investor',
    description: 'Portfolio tracking with market overview',
    icon: <Briefcase className="w-3.5 h-3.5" />,
    layout: [
      { id: 'p1', type: 'market-overview', w: 1, h: 1 },
      { id: 'p2', type: 'btc-price', w: 1, h: 1 },
      { id: 'p3', type: 'fear-greed', w: 1, h: 1 },
      { id: 'p4', type: 'watchlist', w: 1, h: 1 },
      { id: 'p5', type: 'portfolio', w: 1, h: 1 },
      { id: 'p6', type: 'alerts', w: 1, h: 1 },
      { id: 'p7', type: 'dominance', w: 2, h: 1 },
      { id: 'p8', type: 'news', w: 1, h: 1 },
      { id: 'p9', type: 'token-unlocks', w: 1, h: 1 },
    ],
  },
  {
    id: 'defi',
    name: 'DeFi',
    description: 'Derivatives data with funding & open interest',
    icon: <Layers className="w-3.5 h-3.5" />,
    layout: [
      { id: 'p1', type: 'btc-price', w: 1, h: 1 },
      { id: 'p2', type: 'long-short', w: 1, h: 1 },
      { id: 'p3', type: 'market-overview', w: 1, h: 1 },
      { id: 'p4', type: 'funding-heatmap', w: 2, h: 1 },
      { id: 'p5', type: 'oi-chart', w: 2, h: 1 },
      { id: 'p6', type: 'liquidations', w: 1, h: 1 },
      { id: 'p7', type: 'btc-chart', w: 2, h: 1 },
      { id: 'p8', type: 'token-unlocks', w: 1, h: 1 },
    ],
  },
];

interface LayoutPresetsProps {
  onApply: (layout: WidgetLayout[]) => void;
}

export default function LayoutPresets({ onApply }: LayoutPresetsProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (preset: Preset) => {
    if (confirming === preset.id) {
      onApply(preset.layout.map((w) => ({ ...w, id: `w_${Date.now()}_${w.id}` })));
      setOpen(false);
      setConfirming(null);
    } else {
      setConfirming(preset.id);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); setConfirming(null); }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 hover:text-white hover:bg-white/[0.08] transition-colors"
      >
        Presets
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-64 bg-hub-darker border border-white/[0.08] rounded-lg shadow-xl z-50 overflow-hidden">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleSelect(preset)}
              className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-white/[0.06] transition-colors border-b border-white/[0.04] last:border-b-0"
            >
              <span className="text-hub-yellow mt-0.5">{preset.icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-neutral-300">
                  {confirming === preset.id ? `Apply ${preset.name}?` : preset.name}
                </p>
                <p className="text-[10px] text-neutral-600 mt-0.5">
                  {confirming === preset.id
                    ? 'Click again to confirm — replaces current layout'
                    : preset.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
