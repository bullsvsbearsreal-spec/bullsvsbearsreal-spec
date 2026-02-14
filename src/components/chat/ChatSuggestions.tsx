'use client';

import { Zap, TrendingUp, BarChart3, Anchor, Wallet, Activity } from 'lucide-react';

const SUGGESTIONS = [
  { label: 'BTC Funding', prompt: 'What are the current BTC funding rates across exchanges?', icon: TrendingUp },
  { label: 'Top Arb', prompt: 'What are the best funding rate arbitrage opportunities right now?', icon: Zap },
  { label: 'Market Mood', prompt: "What's the current market sentiment and fear/greed index?", icon: Activity },
  { label: 'Whale Watch', prompt: 'What are the top Hyperliquid whales doing right now?', icon: Anchor },
  { label: 'My Portfolio', prompt: 'How is my portfolio performing?', icon: Wallet },
  { label: 'OI Snapshot', prompt: 'Show me the biggest open interest positions right now.', icon: BarChart3 },
];

interface ChatSuggestionsProps {
  onSelect: (prompt: string) => void;
}

export default function ChatSuggestions({ onSelect }: ChatSuggestionsProps) {
  return (
    <div className="flex flex-wrap gap-2 p-3">
      {SUGGESTIONS.map((s) => {
        const Icon = s.icon;
        return (
          <button
            key={s.label}
            onClick={() => onSelect(s.prompt)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full
              bg-white/[0.04] border border-white/[0.08] text-neutral-400
              hover:bg-hub-yellow/10 hover:border-hub-yellow/20 hover:text-hub-yellow
              transition-all duration-200"
          >
            <Icon className="w-3 h-3" />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
