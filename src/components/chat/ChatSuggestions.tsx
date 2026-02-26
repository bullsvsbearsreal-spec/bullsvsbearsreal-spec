'use client';

import { Zap, TrendingUp, BarChart3, Anchor, Activity, Clock } from 'lucide-react';

const SUGGESTIONS = [
  { label: 'BTC Analysis', prompt: 'Give me a full analysis of BTC right now — funding, OI, whale positioning, and sentiment.', icon: TrendingUp },
  { label: 'Top Arb', prompt: 'What are the best funding rate arbitrage opportunities right now?', icon: Zap },
  { label: 'Market Mood', prompt: "What's the overall market sentiment? Fear/greed, top movers, and any red flags?", icon: Activity },
  { label: 'Whale Watch', prompt: 'What are the top Hyperliquid whales doing? Any notable positions?', icon: Anchor },
  { label: 'OI Snapshot', prompt: 'Show me the biggest open interest positions and any notable OI changes.', icon: BarChart3 },
  { label: 'Macro Events', prompt: 'Any upcoming economic events or token unlocks that could move the market?', icon: Clock },
];

interface ChatSuggestionsProps {
  onSelect: (prompt: string) => void;
}

export default function ChatSuggestions({ onSelect }: ChatSuggestionsProps) {
  return (
    <div className="flex flex-wrap gap-1.5 p-3">
      {SUGGESTIONS.map((s) => {
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
