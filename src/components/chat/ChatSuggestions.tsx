'use client';

import {
  Zap, TrendingUp, BarChart3, Anchor, Activity, Clock,
  Target, Landmark, PieChart, ArrowUpDown, Gauge, DollarSign,
} from 'lucide-react';

const POOLS = {
  trading: [
    { label: 'BTC Outlook', prompt: 'BTC — bullish or bearish? Funding, OI, positioning.', icon: TrendingUp },
    { label: 'Best Arbs', prompt: 'Best funding arb opportunities right now.', icon: Zap },
    { label: 'Whale Watch', prompt: 'Top whale positions on Hyperliquid.', icon: Anchor },
    { label: 'OI Shifts', prompt: 'Biggest OI changes — where is money flowing?', icon: BarChart3 },
  ],
  macro: [
    { label: 'Market Vibe', prompt: 'Quick market pulse — sentiment, movers, red flags.', icon: Activity },
    { label: 'Catalysts', prompt: 'Upcoming macro events or token unlocks this week.', icon: Clock },
    { label: 'Cycle Check', prompt: 'Where are we in the cycle? Pi Cycle, S2F, Rainbow.', icon: Gauge },
    { label: 'Flows', prompt: 'Stablecoin + ETF flows — risk on or off?', icon: DollarSign },
  ],
  data: [
    { label: 'Options', prompt: 'BTC options: max pain, PCR, key levels.', icon: Target },
    { label: 'On-Chain', prompt: 'BTC on-chain health check.', icon: Landmark },
    { label: 'OI Momentum', prompt: 'OI delta — which coins are loading up?', icon: ArrowUpDown },
    { label: 'Polymarket', prompt: 'Prediction market arb spreads.', icon: PieChart },
  ],
};

function pickFromPool(pool: typeof POOLS.trading, seed: number, count: number) {
  // Deterministic shuffle using seed
  const indices = pool.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = (seed + i * 7) % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count).map((i) => pool[i]);
}

interface ChatSuggestionsProps {
  onSelect: (prompt: string) => void;
}

export default function ChatSuggestions({ onSelect }: ChatSuggestionsProps) {
  // Rotate every 10 minutes
  const seed = Math.floor(Date.now() / 600000);

  const suggestions = [
    ...pickFromPool(POOLS.trading, seed, 2),
    ...pickFromPool(POOLS.macro, seed + 1, 2),
    ...pickFromPool(POOLS.data, seed + 2, 2),
  ];

  return (
    <div className="flex flex-wrap gap-1.5 p-3">
      {suggestions.map((s) => {
        const Icon = s.icon;
        return (
          <button
            key={s.label}
            onClick={() => onSelect(s.prompt)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg
              bg-white/[0.03] border border-white/[0.06] text-neutral-400
              hover:bg-amber-500/10 hover:border-amber-500/20 hover:text-amber-400
              transition-all duration-200"
          >
            <Icon className="w-3 h-3 flex-shrink-0" />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
