'use client';

import {
  Zap, TrendingUp, BarChart3, Anchor, Activity, Clock,
  Target, Landmark, PieChart, ArrowUpDown, Gauge, DollarSign,
} from 'lucide-react';

const POOLS = {
  trading: [
    { label: 'BTC Outlook', prompt: 'BTC right now. Funding, OI, positioning. Bullish or bearish?', icon: TrendingUp },
    { label: 'Best Arbs', prompt: 'Top funding rate arbitrage opportunities across all exchanges.', icon: Zap },
    { label: 'Whale Watch', prompt: 'Biggest whale positions on Hyperliquid right now. Who is loaded?', icon: Anchor },
    { label: 'Money Flow', prompt: 'Where is smart money going? Show me the biggest OI changes in the last few hours.', icon: BarChart3 },
    { label: 'ETH vs SOL', prompt: 'ETH vs SOL. Compare funding, OI, momentum. Which looks stronger?', icon: ArrowUpDown },
  ],
  macro: [
    { label: 'Market Pulse', prompt: 'Quick market overview. Sentiment, top movers, any red flags I should know about.', icon: Activity },
    { label: 'This Week', prompt: 'What major events, token unlocks, or catalysts are coming this week?', icon: Clock },
    { label: 'Cycle Check', prompt: 'Where are we in the market cycle? Check on-chain metrics and macro indicators.', icon: Gauge },
    { label: 'Capital Flows', prompt: 'Stablecoin inflows + ETF flows. Is capital entering or leaving crypto?', icon: DollarSign },
  ],
  data: [
    { label: 'Options Flow', prompt: 'BTC options overview. Max pain, put/call ratio, key strikes, notable activity.', icon: Target },
    { label: 'On-Chain', prompt: 'BTC on-chain health check. MVRV, Puell, exchange flows.', icon: Landmark },
    { label: 'Squeeze Radar', prompt: 'Any coins with OI building against price? Looking for squeeze setups.', icon: ArrowUpDown },
    { label: 'Top Yields', prompt: 'Best DeFi yields right now for stablecoins. Low risk, high APY.', icon: PieChart },
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
