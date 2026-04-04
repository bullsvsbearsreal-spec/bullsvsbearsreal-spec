'use client';

import { useState, useEffect } from 'react';
import { Lightbulb, X } from 'lucide-react';
import Link from 'next/link';

const VISITED_KEY = 'infohub-visited-pages';
const HINT_SHOWN_KEY = 'infohub-hint-shown-session';

interface HintConfig {
  text: string;
  guide?: string;
}

const PAGE_HINTS: Record<string, HintConfig> = {
  '/funding': {
    text: 'Use Ctrl+K to quickly search any coin, or try the Heatmap view for a visual overview.',
    guide: '/guides/funding-rate-arbitrage',
  },
  '/liquidations': {
    text: 'Whale liquidations ($500K+) are highlighted in red. Filter by exchange or side.',
  },
  '/dashboard': {
    text: 'Drag widgets to rearrange. Click the + button to add more, or pick a preset.',
  },
  '/chart': {
    text: 'Press 1-7 for timeframes, T for the trade tape, ? for all shortcuts.',
  },
  '/open-interest': {
    text: 'Rising OI + rising price signals a strong trend. Toggle between chart and heatmap views.',
  },
  '/spreads': {
    text: 'Compare funding rates across exchanges to spot arbitrage opportunities.',
    guide: '/guides/funding-rate-arbitrage',
  },
};

interface FeatureHintProps {
  page: string;
}

export default function FeatureHint({ page }: FeatureHintProps) {
  const [visible, setVisible] = useState(false);
  const [hint, setHint] = useState<HintConfig | null>(null);

  useEffect(() => {
    try {
      // Only show one hint per session
      const sessionHintShown = sessionStorage.getItem(HINT_SHOWN_KEY);
      if (sessionHintShown) return;

      // Check if user already visited this page
      let visited: string[] = [];
      try {
        const stored = localStorage.getItem(VISITED_KEY);
        if (stored) visited = JSON.parse(stored);
      } catch {}

      const hintConfig = PAGE_HINTS[page];
      if (!hintConfig || visited.includes(page)) {
        // Mark page as visited even if no hint
        if (!visited.includes(page)) {
          visited.push(page);
          try { localStorage.setItem(VISITED_KEY, JSON.stringify(visited)); } catch {}
        }
        return;
      }

      // Show hint for first visit
      setHint(hintConfig);
      setVisible(true);
      try { sessionStorage.setItem(HINT_SHOWN_KEY, 'true'); } catch {}

      // Mark page visited
      visited.push(page);
      try { localStorage.setItem(VISITED_KEY, JSON.stringify(visited)); } catch {}
    } catch {}
  }, [page]);

  const dismiss = () => setVisible(false);

  if (!visible || !hint) return null;

  return (
    <div className="mb-3 animate-fade-in">
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-hub-yellow/[0.04] border border-hub-yellow/15">
        <Lightbulb className="w-4 h-4 text-hub-yellow flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-neutral-300 leading-relaxed">
            <span className="text-hub-yellow font-semibold">Tip: </span>
            {hint.text}
          </p>
          {hint.guide && (
            <Link
              href={hint.guide}
              className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-hub-yellow/70 hover:text-hub-yellow transition-colors"
            >
              Learn more &rarr;
            </Link>
          )}
        </div>
        <button
          onClick={dismiss}
          className="text-neutral-600 hover:text-white transition-colors p-0.5 flex-shrink-0"
          aria-label="Dismiss tip"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
