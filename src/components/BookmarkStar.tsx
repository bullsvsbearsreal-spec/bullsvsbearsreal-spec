'use client';

import { Star } from 'lucide-react';
import { useTraderBookmarks } from '@/hooks/useTraderBookmarks';

interface BookmarkStarProps {
  address: string;
  displayName?: string | null;
  venues?: string[];
  size?: number;
  className?: string;
}

/**
 * Star icon that toggles a trader bookmark. Filled gold when bookmarked,
 * outlined neutral otherwise. Persists via useTraderBookmarks (localStorage).
 */
export default function BookmarkStar({
  address,
  displayName,
  venues,
  size = 14,
  className = '',
}: BookmarkStarProps) {
  const { isBookmarked, toggle } = useTraderBookmarks();
  const starred = isBookmarked(address);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle({ address, displayName, venues });
      }}
      className={`inline-flex items-center justify-center p-0.5 rounded transition-colors ${
        starred
          ? 'text-hub-yellow hover:text-hub-yellow/80'
          : 'text-neutral-600 hover:text-hub-yellow'
      } ${className}`}
      aria-label={starred ? 'Remove bookmark' : 'Bookmark this trader'}
      title={starred ? 'Remove bookmark' : 'Bookmark this trader'}
    >
      <Star
        width={size}
        height={size}
        fill={starred ? 'currentColor' : 'none'}
        strokeWidth={starred ? 0 : 2}
      />
    </button>
  );
}
