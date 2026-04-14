'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, X } from 'lucide-react';
import { getRecentlyViewed, clearRecentlyViewed, type RecentItem } from '@/lib/storage/recentlyViewed';

/**
 * Horizontal strip of recently-viewed pages.
 * Reads from localStorage on mount — renders nothing if the list is empty
 * (so first-time visitors never see a blank row).
 */
export default function RecentPages() {
  const [items, setItems] = useState<RecentItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(getRecentlyViewed().slice(0, 6));
    setHydrated(true);
  }, []);

  const handleClear = () => {
    clearRecentlyViewed();
    setItems([]);
  };

  // Don't render anything until we've hydrated — avoids SSR/client mismatch
  // and avoids reserving layout space for users with no history.
  if (!hydrated || items.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mb-5 -mt-1">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500 flex-shrink-0">
        <Clock className="w-3 h-3" />
        Recent
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1">
        {items.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            className="flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] text-[11px] text-neutral-300 hover:text-white transition-colors whitespace-nowrap flex-shrink-0"
          >
            {item.symbol && (
              <span className="text-neutral-500 font-mono text-[10px]">{item.symbol}</span>
            )}
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
      <button
        onClick={handleClear}
        className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-neutral-600 hover:text-neutral-300 hover:bg-white/[0.04] transition-colors"
        aria-label="Clear recent pages"
        title="Clear recent"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
