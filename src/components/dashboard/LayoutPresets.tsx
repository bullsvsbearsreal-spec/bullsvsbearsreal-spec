'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, BarChart3, Briefcase, Layers, Zap, Repeat, Eye, Globe } from 'lucide-react';
import { type WidgetLayout } from './types';

export interface Preset {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  layout: WidgetLayout[];
}

/** Get a preset's layout by ID, with unique widget IDs */
export function getPresetLayout(presetId: string): WidgetLayout[] | null {
  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  return preset.layout.map((w) => ({ ...w, id: `w_${Date.now()}_${w.id}` }));
}

export const PRESETS: Preset[] = [
  {
    id: 'market-pulse',
    name: 'Market Pulse',
    description: 'Curated overview — great starting point for everyone',
    icon: <Zap className="w-3.5 h-3.5" />,
    layout: [
      { id: 'p1', type: 'btc-price', w: 1, h: 1 },
      { id: 'p2', type: 'market-overview', w: 1, h: 1 },
      { id: 'p3', type: 'fear-greed', w: 1, h: 1 },
      { id: 'p4', type: 'top-movers', w: 1, h: 1 },
      { id: 'p5', type: 'funding-heatmap', w: 2, h: 1 },
      { id: 'p6', type: 'liquidations', w: 1, h: 1 },
    ],
  },
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
  {
    id: 'funding-arb',
    name: 'Funding Arb',
    description: 'Funding rate arbitrage across exchanges',
    icon: <Repeat className="w-3.5 h-3.5" />,
    layout: [
      { id: 'p1', type: 'funding-heatmap', w: 2, h: 1 },
      { id: 'p2', type: 'arbitrage', w: 2, h: 1 },
      { id: 'p3', type: 'btc-price', w: 1, h: 1 },
      { id: 'p4', type: 'long-short', w: 1, h: 1 },
      { id: 'p5', type: 'slippage', w: 1, h: 1 },
      { id: 'p6', type: 'exchange-status', w: 1, h: 1 },
      { id: 'p7', type: 'oi-chart', w: 2, h: 1 },
    ],
  },
  {
    id: 'whale-watcher',
    name: 'Whale Watcher',
    description: 'Track large positions, liquidations & CVD',
    icon: <Eye className="w-3.5 h-3.5" />,
    layout: [
      { id: 'p1', type: 'btc-price', w: 1, h: 1 },
      { id: 'p2', type: 'liquidations', w: 1, h: 1 },
      { id: 'p3', type: 'long-short', w: 1, h: 1 },
      { id: 'p4', type: 'cvd', w: 2, h: 1 },
      { id: 'p5', type: 'oi-chart', w: 2, h: 1 },
      { id: 'p6', type: 'stablecoin-flows', w: 1, h: 1 },
      { id: 'p7', type: 'top-movers', w: 1, h: 1 },
      { id: 'p8', type: 'news', w: 1, h: 1 },
    ],
  },
  {
    id: 'macro-monitor',
    name: 'Macro Monitor',
    description: 'Economic events, sentiment & market structure',
    icon: <Globe className="w-3.5 h-3.5" />,
    layout: [
      { id: 'p1', type: 'btc-price', w: 1, h: 1 },
      { id: 'p2', type: 'fear-greed', w: 1, h: 1 },
      { id: 'p3', type: 'altseason', w: 1, h: 1 },
      { id: 'p4', type: 'dominance', w: 2, h: 1 },
      { id: 'p5', type: 'economic-calendar', w: 1, h: 1 },
      { id: 'p6', type: 'fear-greed-chart', w: 2, h: 1 },
      { id: 'p7', type: 'news', w: 1, h: 1 },
      { id: 'p8', type: 'token-unlocks', w: 1, h: 1 },
      { id: 'p9', type: 'stablecoin-flows', w: 1, h: 1 },
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
        <div className="absolute top-full left-0 mt-1.5 w-64 bg-hub-darker border border-white/[0.08] rounded-lg shadow-xl z-50 overflow-y-auto max-h-[420px] scrollbar-accent">
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
