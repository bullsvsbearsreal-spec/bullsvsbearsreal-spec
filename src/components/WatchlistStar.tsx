'use client';

import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { isInWatchlist, addToWatchlist, removeFromWatchlist } from '@/lib/storage/watchlist';

/**
 * Inline star toggle for adding/removing a symbol from watchlist.
 * Reads from localStorage on mount, updates on click.
 */
export default function WatchlistStar({ symbol }: { symbol: string }) {
  const [starred, setStarred] = useState(false);

  useEffect(() => {
    setStarred(isInWatchlist(symbol));
  }, [symbol]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (starred) {
      removeFromWatchlist(symbol);
    } else {
      addToWatchlist(symbol);
    }
    setStarred(!starred);
  };

  return (
    <button
      onClick={toggle}
      className={`p-0.5 rounded transition-colors ${
        starred
          ? 'text-hub-yellow hover:text-hub-yellow/70'
          : 'text-neutral-700 hover:text-neutral-400'
      }`}
      aria-label={starred ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
    >
      <Star className="w-3.5 h-3.5" fill={starred ? 'currentColor' : 'none'} />
    </button>
  );
}
