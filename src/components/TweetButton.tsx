'use client';

import { useCallback } from 'react';

interface TweetButtonProps {
  /** The tweet text (max ~280 chars). URL is appended automatically. */
  text: string;
  /** Page URL to share. Defaults to current page. */
  url?: string;
  /** Extra CSS classes */
  className?: string;
  /** Compact mode — icon only */
  compact?: boolean;
}

/**
 * Coinglass-style "Share on X" button.
 * Opens a pre-filled tweet intent with the page URL (which has OG image via /api/og).
 */
export default function TweetButton({ text, url, className = '', compact = false }: TweetButtonProps) {
  const handleTweet = useCallback(() => {
    const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : 'https://info-hub.io');
    const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
  }, [text, url]);

  return (
    <button
      onClick={handleTweet}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
        text-neutral-400 hover:text-white bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08]
        hover:border-[#1d9bf0]/30 hover:text-[#1d9bf0] ${className}`}
      title="Share on X"
    >
      {/* X (Twitter) logo */}
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      {!compact && <span>Tweet</span>}
    </button>
  );
}
