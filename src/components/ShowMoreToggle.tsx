'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';

interface ShowMoreToggleProps {
  expanded: boolean;
  onToggle: () => void;
  totalCount: number;
  visibleCount: number;
}

/**
 * "Show all X" / "Show top N" toggle button for progressive disclosure.
 */
export default function ShowMoreToggle({ expanded, onToggle, totalCount, visibleCount }: ShowMoreToggleProps) {
  if (totalCount <= visibleCount) return null;

  return (
    <div className="px-4 py-2 border-t border-white/[0.04]">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 mx-auto text-xs font-medium text-neutral-500 hover:text-hub-yellow transition-colors"
      >
        {expanded ? (
          <>
            <ChevronUp className="w-3.5 h-3.5" />
            Show top {visibleCount}
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5" />
            Show all {totalCount}
          </>
        )}
      </button>
    </div>
  );
}
